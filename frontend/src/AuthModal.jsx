import { useEffect, useState } from 'react'
import { api, setToken } from './api'
import { Icon, Logo, MAJORS } from './ui'

export default function AuthModal({ isOpen, onClose, onSuccess, initialMode = 'login', defaultMajor = '' }) {
  const [mode, setMode] = useState(initialMode)
  const [f, setF] = useState({ username: '', password: '', major: defaultMajor || '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || 'login')
      setF((prev) => ({ ...prev, major: defaultMajor || prev.major || '' }))
      setErr('')
      setBusy(false)
    }
  }, [isOpen, initialMode, defaultMajor])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const r = await api('/auth/' + mode, { method: 'POST', body: f })
      setToken(r.token)
      // fetch me
      const u = await api('/me')
      onSuccess(u)
    } catch (x) {
      setErr(x.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (m) => {
    setMode(m)
    setErr('')
  }

  return (
    <div className="modal-back auth-modal-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <button className="auth-modal-close" onClick={onClose} aria-label="Đóng cửa sổ">
          <Icon n="x" size={20} />
        </button>

        <div className="auth-modal-hero">
          <div className="auth-modal-brand">
            <Logo size={46} />
            <div>
              <span className="pill auth-pill"><Icon n="spark" size={13} /> Trợ lý AI Sinh viên UTC</span>
              <h2 id="auth-modal-title">{mode === 'login' ? 'Đăng nhập tài khoản' : 'Đăng ký tài khoản sinh viên'}</h2>
              <p className="auth-modal-sub">
                {mode === 'login'
                  ? 'Đăng nhập để tra cứu chi tiết mọi chuyên ngành và đồng bộ lịch sử trò chuyện.'
                  : 'Tạo tài khoản miễn phí chỉ trong vài giây để mở khóa toàn bộ chương trình đào tạo.'}
              </p>
            </div>
          </div>

          <div className="auth-perks">
            <div className="auth-perk-item">
              <span className="perk-ico"><Icon n="cap" size={16} /></span>
              <div>
                <b>Mở khóa tra cứu theo ngành</b>
                <small>CNTT, Cơ khí, Xây dựng, Vận tải kinh tế, ĐTQT…</small>
              </div>
            </div>
            <div className="auth-perk-item">
              <span className="perk-ico"><Icon n="book" size={16} /></span>
              <div>
                <b>Học phần & Môn tiên quyết</b>
                <small>Tra cứu số tín chỉ, môn học trước và lộ trình học tập</small>
              </div>
            </div>
            <div className="auth-perk-item">
              <span className="perk-ico"><Icon n="chat" size={16} /></span>
              <div>
                <b>Lưu & Đồng bộ lịch sử chat</b>
                <small>Xem lại các câu hỏi và câu trả lời bất cứ lúc nào</small>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-modal-content">
          <div className="seg auth-seg" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'on' : ''}
              onClick={() => switchMode('login')}
            >
              <Icon n="users" size={16} /> Đăng nhập
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'on' : ''}
              onClick={() => switchMode('register')}
            >
              <Icon n="spark" size={16} /> Đăng ký tài khoản
            </button>
          </div>

          <form className="auth-form" onSubmit={submit}>
            <label className="field">
              <span>Tên đăng nhập / Mã sinh viên</span>
              <div className="input">
                <Icon n="users" />
                <input
                  value={f.username}
                  onChange={set('username')}
                  placeholder="vd: 223630671 hoặc tên của bạn"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>
            </label>

            <label className="field">
              <span>Mật khẩu</span>
              <div className="input">
                <Icon n="shield" />
                <input
                  type={show ? 'text' : 'password'}
                  value={f.password}
                  onChange={set('password')}
                  placeholder={mode === 'register' ? 'Tối thiểu 6 ký tự' : 'Nhập mật khẩu của bạn'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  className="ghost-ico"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  <Icon n={show ? 'eyeoff' : 'eye'} />
                </button>
              </div>
            </label>

            {mode === 'register' && (
              <label className="field auth-field-anim">
                <span>Ngành học của bạn <small className="muted">(giúp Chatbot ưu tiên tài liệu phù hợp)</small></span>
                <div className="input">
                  <Icon n="cap" />
                  <select value={f.major} onChange={set('major')}>
                    <option value="">Không chọn – tra cứu tất cả các ngành</option>
                    {MAJORS.filter(([k]) => k !== 'chung').map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </label>
            )}

            {err && (
              <div className="alert err" role="alert">
                <Icon n="alert" />
                <span>{err}</span>
              </div>
            )}

            <button className="btn primary lg auth-submit" disabled={busy}>
              {busy ? (
                <><span className="spin" /> Đang xử lý…</>
              ) : mode === 'login' ? (
                <><Icon n="users" size={18} /> Đăng nhập ngay</>
              ) : (
                <><Icon n="spark" size={18} /> Hoàn tất đăng ký & Khám phá</>
              )}
            </button>

            <div className="auth-footer-links">
              <p className="auth-switch muted">
                {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
                <button
                  type="button"
                  className="link"
                  onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                >
                  {mode === 'login' ? 'Đăng ký miễn phí ngay' : 'Đăng nhập tại đây'}
                </button>
              </p>
              <button type="button" className="auth-guest-link" onClick={onClose}>
                Tiếp tục ở chế độ Khách (chỉ hỏi quy chế chung) <Icon n="arrowRight" size={14} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
