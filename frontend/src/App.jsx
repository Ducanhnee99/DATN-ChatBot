import { useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken } from './api'
import Chat from './Chat'
import Admin from './Admin'
import Users from './Users'
import AuthModal from './AuthModal'
import { Avatar, Icon, Logo, Toaster, majorName, toast, useTheme } from './ui'

/* ---------------- Nhóm lịch sử theo thời gian ---------------- */
function groupConvs(convs, filter) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
  const g = { 'Hôm nay': [], 'Hôm qua': [], '7 ngày qua': [], 'Cũ hơn': [] }
  ;(convs || [])
    .filter((c) => c.title.toLowerCase().includes(filter.toLowerCase()))
    .forEach((c) => {
      const k =
        c.ts >= start
          ? 'Hôm nay'
          : c.ts >= start - 86400
          ? 'Hôm qua'
          : c.ts >= start - 7 * 86400
          ? '7 ngày qua'
          : 'Cũ hơn'
      g[k].push(c)
    })
  return Object.entries(g).filter(([, v]) => v.length)
}

/* ---------------- Ứng dụng chính ---------------- */
export default function App() {
  const [dark, toggleTheme] = useTheme()
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState('chat')
  const [convs, setConvs] = useState([])
  const [cid, setCid] = useState(null)
  const [chatKey, setChatKey] = useState(0)
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(false)

  // Auth modal state
  const [authModal, setAuthModal] = useState({ open: false, mode: 'login', defaultMajor: '' })
  const openAuth = (mode = 'login', defaultMajor = '') => setAuthModal({ open: true, mode, defaultMajor })
  const closeAuth = () => setAuthModal((prev) => ({ ...prev, open: false }))

  const load = () =>
    (getToken() ? api('/me').then(setUser).catch(() => setUser(null)) : Promise.resolve(setUser(null))).finally(() =>
      setReady(true)
    )

  const loadConvs = () => {
    if (!getToken()) {
      setConvs([])
      return Promise.resolve()
    }
    return api('/conversations')
      .then(setConvs)
      .catch((e) => toast(e.message, 'err'))
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (user) {
      loadConvs()
    } else {
      setConvs([])
      if (tab !== 'chat') setTab('chat')
    }
  }, [user])

  const groups = useMemo(() => groupConvs(convs, filter), [convs, filter])
  const current = convs.find((c) => c.id === cid)

  const fresh = () => {
    setCid(null)
    setChatKey((k) => k + 1)
    setTab('chat')
    setOpen(false)
  }

  const pick = (id) => {
    setCid(id)
    setTab('chat')
    setOpen(false)
  }

  const del = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Xóa cuộc trò chuyện này? Thao tác không thể hoàn tác.')) return
    try {
      await api('/conversations/' + id, { method: 'DELETE' })
      if (id === cid) fresh()
      loadConvs()
      toast('Đã xóa cuộc trò chuyện')
    } catch (x) {
      toast(x.message, 'err')
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    setConvs([])
    setCid(null)
    setTab('chat')
    toast('Đã đăng xuất tài khoản')
  }

  if (!ready) {
    return (
      <div className="boot">
        <Logo size={52} />
        <span className="spin dark" />
      </div>
    )
  }

  return (
    <div className={'shell' + (open ? ' nav-open' : '')}>
      <aside className="sidebar">
        <div className="sb-head">
          <Logo size={36} />
          <div className="sb-title">
            <b>Trợ lý học vụ UTC</b>
            <small>Tra cứu · Tư vấn CTĐT</small>
          </div>
          <button className="icon-btn only-m" onClick={() => setOpen(false)} aria-label="Đóng menu">
            <Icon n="x" />
          </button>
        </div>

        <button className="btn primary block" onClick={fresh}>
          <Icon n="plus" /> Cuộc trò chuyện mới
        </button>

        {user && user.role === 'admin' && (
          <nav className="sb-nav">
            <button className={tab === 'chat' ? 'on' : ''} onClick={() => { setTab('chat'); setOpen(false) }}>
              <Icon n="chat" /> Trò chuyện
            </button>
            <button className={tab === 'admin' ? 'on' : ''} onClick={() => { setTab('admin'); setOpen(false) }}>
              <Icon n="layers" /> Tổng quan & tài liệu
            </button>
            <button className={tab === 'users' ? 'on' : ''} onClick={() => { setTab('users'); setOpen(false) }}>
              <Icon n="users" /> Người dùng
            </button>
          </nav>
        )}

        {/* Sidebar content: If logged in, show history; if guest, show enticing promo card */}
        {user ? (
          <>
            <div className="sb-search">
              <Icon n="search" size={16} />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Tìm cuộc trò chuyện…"
                aria-label="Tìm cuộc trò chuyện"
              />
            </div>

            <div className="sb-list">
              {convs.length === 0 && (
                <p className="sb-empty">
                  Chưa có cuộc trò chuyện nào.<br />Hãy đặt câu hỏi đầu tiên!
                </p>
              )}
              {convs.length > 0 && groups.length === 0 && <p className="sb-empty">Không tìm thấy kết quả.</p>}
              {groups.map(([label, items]) => (
                <div key={label} className="sb-group">
                  <span className="sb-label">{label}</span>
                  {items.map((c) => (
                    <div
                      key={c.id}
                      className={'conv' + (c.id === cid && tab === 'chat' ? ' on' : '')}
                      onClick={() => pick(c.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && pick(c.id)}
                      title={c.title}
                    >
                      <Icon n="chat" size={16} />
                      <span>{c.title}</span>
                      <button className="conv-del" onClick={(e) => del(e, c.id)} aria-label="Xóa cuộc trò chuyện">
                        <Icon n="trash" size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="sb-guest-section">
            <div className="guest-promo-card">
              <div className="guest-promo-head">
                <span className="promo-badge"><Icon n="spark" size={13} /> Tài khoản sinh viên</span>
                <b>Mở khóa tra cứu theo từng ngành</b>
              </div>
              <p>
                Đăng ký tài khoản để tra cứu chi tiết môn học, tiên quyết, số tín chỉ của từng ngành và lưu lại lịch sử hội thoại.
              </p>
              <div className="guest-promo-actions">
                <button className="btn primary sm block" onClick={() => openAuth('register')}>
                  <Icon n="spark" size={14} /> Đăng ký tài khoản
                </button>
                <button className="btn sm block" onClick={() => openAuth('login')}>
                  <Icon n="users" size={14} /> Đăng nhập
                </button>
              </div>
            </div>

            <div className="guest-features-list">
              <div className="guest-feature-item">
                <Icon n="cap" size={16} />
                <span>Xem chi tiết CTĐT tất cả các khoa viện</span>
              </div>
              <div className="guest-feature-item">
                <Icon n="book" size={16} />
                <span>Kiểm tra môn học tiên quyết, mã học phần</span>
              </div>
              <div className="guest-feature-item">
                <Icon n="chat" size={16} />
                <span>Lưu & đồng bộ lịch sử hỏi đáp</span>
              </div>
            </div>
          </div>
        )}

        <div className="sb-user">
          {user ? (
            <>
              <Avatar name={user.username} />
              <div className="sb-user-info">
                <b>{user.username}</b>
                <small>
                  {user.role === 'admin' ? 'Quản trị viên' : 'Sinh viên'}
                  {user.major ? ' · ' + majorName(user.major) : ''}
                </small>
              </div>
              <button className="icon-btn" onClick={toggleTheme} aria-label="Đổi giao diện sáng/tối" title="Sáng / Tối">
                <Icon n={dark ? 'sun' : 'moon'} />
              </button>
              <button className="icon-btn" onClick={logout} aria-label="Đăng xuất" title="Đăng xuất">
                <Icon n="logout" />
              </button>
            </>
          ) : (
            <>
              <span className="avatar guest-avatar"><Icon n="users" size={18} /></span>
              <div className="sb-user-info">
                <b>Khách</b>
                <small>Chưa đăng nhập</small>
              </div>
              <button className="icon-btn" onClick={toggleTheme} aria-label="Đổi giao diện sáng/tối" title="Sáng / Tối">
                <Icon n={dark ? 'sun' : 'moon'} />
              </button>
              <button
                className="icon-btn"
                onClick={() => openAuth('login')}
                aria-label="Đăng nhập"
                title="Đăng nhập / Đăng ký"
              >
                <Icon n="users" />
              </button>
            </>
          )}
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />

      <main className="main">
        <header className="topbar">
          <button className="icon-btn only-m" onClick={() => setOpen(true)} aria-label="Mở menu">
            <Icon n="menu" />
          </button>
          <h1>
            {tab === 'admin'
              ? 'Tổng quan & tài liệu'
              : tab === 'users'
              ? 'Quản lý người dùng'
              : current?.title || (user ? 'Cuộc trò chuyện mới' : 'Trợ lý học vụ UTC')}
          </h1>

          {tab === 'chat' && (
            <div className="topbar-actions">
              {user ? (
                <span className="badge" title="Tài liệu được lọc theo ngành của bạn và tài liệu chung">
                  <Icon n="cap" size={14} /> {user.major ? majorName(user.major) : 'Tất cả ngành'}
                </span>
              ) : (
                <>
                  <span className="badge guest-badge" title="Bạn có thể hỏi tất cả quy chế và thông tin trường. Đăng nhập để hỏi theo ngành!">
                    <Icon n="info" size={14} /> Chế độ Khách (Quy chế chung)
                  </span>
                  <button className="btn sm topbar-auth-btn" onClick={() => openAuth('login')}>
                    <Icon n="users" size={14} /> Đăng nhập
                  </button>
                  <button className="btn primary sm topbar-auth-btn" onClick={() => openAuth('register')}>
                    <Icon n="spark" size={14} /> Đăng ký
                  </button>
                </>
              )}
            </div>
          )}
        </header>

        {tab === 'chat' && (
          <Chat
            key={chatKey}
            cid={cid}
            onCid={setCid}
            onChanged={loadConvs}
            user={user}
            onOpenAuth={openAuth}
          />
        )}
        {tab === 'admin' && user?.role === 'admin' && <Admin />}
        {tab === 'users' && user?.role === 'admin' && <Users me={user} onSelfChange={load} />}
      </main>

      {/* Redesigned Authentication Modal */}
      <AuthModal
        isOpen={authModal.open}
        onClose={closeAuth}
        onSuccess={(u) => {
          closeAuth()
          load()
          toast('Đăng nhập thành công! Chào mừng ' + (u?.username || 'bạn'))
        }}
        initialMode={authModal.mode}
        defaultMajor={authModal.defaultMajor}
      />

      <Toaster />
    </div>
  )
}
