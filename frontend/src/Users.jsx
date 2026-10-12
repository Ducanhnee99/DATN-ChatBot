import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { Avatar, Icon, MAJORS, majorName, toast } from './ui'

const ago = (ts) => {
  if (!ts) return 'Chưa hoạt động'
  const s = Date.now() / 1000 - ts
  if (s < 60) return 'Vừa xong'
  if (s < 3600) return Math.floor(s / 60) + ' phút trước'
  if (s < 86400) return Math.floor(s / 3600) + ' giờ trước'
  if (s < 30 * 86400) return Math.floor(s / 86400) + ' ngày trước'
  return new Date(ts * 1000).toLocaleDateString('vi-VN')
}

/* Hộp thoại chỉnh sửa tài khoản */
function EditUser({ u, me, onClose, onSaved }) {
  const [role, setRole] = useState(u.role)
  const [major, setMajor] = useState(u.major || '')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const self = u.id === me.id

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    addEventListener('keydown', esc); return () => removeEventListener('keydown', esc)
  }, [])

  const save = async (e) => {
    e.preventDefault()
    if (pw && pw.length < 6) return toast('Mật khẩu mới tối thiểu 6 ký tự', 'err')
    setBusy(true)
    try {
      if (role !== u.role || major !== (u.major || '')) {
        await api('/admin/users/' + u.id, { method: 'PATCH', body: { role, major } })
      }
      if (pw) await api(`/admin/users/${u.id}/password`, { method: 'POST', body: { password: pw } })
      toast('Đã cập nhật tài khoản ' + u.username + (pw && !self ? ' · người dùng cần đăng nhập lại' : ''))
      onSaved()
    } catch (x) { toast(x.message, 'err') } finally { setBusy(false) }
  }
  const gen = () => { setPw(Math.random().toString(36).slice(2, 6) + Math.floor(1000 + Math.random() * 9000)); setShow(true) }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="eu-title">
        <div className="modal-head">
          <Avatar name={u.username} size={42} />
          <div><h3 id="eu-title">{u.username}</h3><small className="muted">ID #{u.id} · {u.conversations} cuộc trò chuyện · {u.questions} câu hỏi</small></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng"><Icon n="x" /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <span>Vai trò</span>
            <div className="role-pick">
              {[['student', 'cap', 'Sinh viên', 'Trò chuyện, tra cứu'], ['admin', 'shield', 'Quản trị viên', 'Toàn quyền hệ thống']].map(([k, i, t, d]) => (
                <button type="button" key={k} className={role === k ? 'on' : ''} disabled={self} onClick={() => setRole(k)}>
                  <Icon n={i} size={20} /><b>{t}</b><small>{d}</small>
                </button>
              ))}
            </div>
            {self && <small className="muted hint"><Icon n="info" size={14} /> Bạn không thể tự thay đổi quyền của chính mình.</small>}
          </div>

          <label className="field">
            <span>Ngành học</span>
            <div className="input"><Icon n="cap" />
              <select value={major} onChange={(e) => setMajor(e.target.value)}>
                <option value="">Không chọn – tra cứu tất cả ngành</option>
                {MAJORS.filter(([k]) => k !== 'chung').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                {major && !MAJORS.some(([k]) => k === major) && <option value={major}>{major}</option>}
              </select>
            </div>
          </label>

          <label className="field">
            <span>Đặt lại mật khẩu <small className="muted">(để trống nếu không đổi)</small></span>
            <div className="input"><Icon n="shield" />
              <input type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mật khẩu mới, tối thiểu 6 ký tự" autoComplete="new-password" />
              <button type="button" className="ghost-ico" onClick={() => setShow(!show)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}><Icon n={show ? 'eyeoff' : 'eye'} /></button>
              <button type="button" className="mini" onClick={gen}>Tạo ngẫu nhiên</button>
            </div>
          </label>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Hủy</button>
          <button className="btn primary" disabled={busy}>{busy && <span className="spin" />} Lưu thay đổi</button>
        </div>
      </form>
    </div>
  )
}

export default function Users({ me, onSelfChange }) {
  const [users, setUsers] = useState(null)
  const [kw, setKw] = useState('')
  const [rf, setRf] = useState('')
  const [edit, setEdit] = useState(null)

  const load = () => api('/admin/users').then(setUsers).catch((e) => toast(e.message, 'err'))
  useEffect(() => { load() }, [])

  const list = users || []
  const shown = useMemo(() => list.filter((u) => (!rf || u.role === rf)
    && (u.username.includes(kw.toLowerCase()) || majorName(u.major).toLowerCase().includes(kw.toLowerCase()))), [list, kw, rf])
  const nAdmin = list.filter((u) => u.role === 'admin').length
  const active7 = list.filter((u) => u.last_active && Date.now() / 1000 - u.last_active < 7 * 86400).length

  const del = async (u) => {
    if (!confirm(`Xóa tài khoản “${u.username}”?\n\nToàn bộ ${u.conversations} cuộc trò chuyện và ${u.questions} câu hỏi của tài khoản này cũng sẽ bị xóa vĩnh viễn.`)) return
    try { await api('/admin/users/' + u.id, { method: 'DELETE' }); toast('Đã xóa tài khoản ' + u.username); load() }
    catch (x) { toast(x.message, 'err') }
  }

  const cards = [
    ['users', 'Tổng tài khoản', list.length, 'blue'],
    ['cap', 'Sinh viên', list.length - nAdmin, 'teal'],
    ['shield', 'Quản trị viên', nAdmin, 'violet'],
    ['spark', 'Hoạt động 7 ngày qua', active7, 'amber'],
  ]

  return (
    <div className="admin">
      <div className="admin-inner">
        <section>
          <div className="sec-head">
            <div><h2>Quản lý người dùng</h2><p className="muted">Xem, phân quyền, đổi ngành, đặt lại mật khẩu và xóa tài khoản.</p></div>
            <button className="btn" onClick={load}><Icon n="refresh" size={16} /> Làm mới</button>
          </div>
          <div className="stats">
            {!users && [1, 2, 3, 4].map((i) => <div key={i} className="stat skel" />)}
            {users && cards.map(([i, k, v, c]) => (
              <div key={k} className={'stat ' + c}>
                <span className="stat-ico"><Icon n={i} size={20} /></span>
                <b>{v.toLocaleString('vi-VN')}</b><small>{k}</small>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="chips">
            {[['', 'Tất cả', list.length], ['student', 'Sinh viên', list.length - nAdmin], ['admin', 'Quản trị viên', nAdmin]].map(([k, t, n]) => (
              <button key={k} className={rf === k ? 'on' : ''} onClick={() => setRf(k)}>{t} <em>{n}</em></button>
            ))}
          </div>

          <div className="card table-card">
            <div className="table-tools">
              <div className="sb-search"><Icon n="search" size={16} /><input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Tìm theo tên đăng nhập hoặc ngành…" /></div>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Ngành</th><th className="r">Trò chuyện</th><th className="r">Câu hỏi</th><th>Hoạt động gần nhất</th><th /></tr></thead>
                <tbody>
                  {users && shown.length === 0 && (
                    <tr><td colSpan="7" className="empty-row"><Icon n="users" size={28} /><div>Không có tài khoản phù hợp.</div></td></tr>
                  )}
                  {shown.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="doc">
                          <Avatar name={u.username} size={32} />
                          <div className="u-name"><b>{u.username}</b>{u.id === me.id && <span className="you">Bạn</span>}<small className="muted">ID #{u.id}</small></div>
                        </div>
                      </td>
                      <td><span className={'role ' + u.role}><Icon n={u.role === 'admin' ? 'shield' : 'cap'} size={13} />{u.role === 'admin' ? 'Quản trị viên' : 'Sinh viên'}</span></td>
                      <td>{u.major ? <span className="tag">{majorName(u.major)}</span> : <span className="muted">—</span>}</td>
                      <td className="r">{u.conversations}</td>
                      <td className="r">{u.questions}</td>
                      <td className="muted nowrap">{ago(u.last_active)}</td>
                      <td className="r nowrap">
                        <button className="icon-btn" onClick={() => setEdit(u)} aria-label={'Chỉnh sửa ' + u.username} title="Chỉnh sửa"><Icon n="edit" size={16} /></button>
                        <button className="icon-btn danger" onClick={() => del(u)} disabled={u.id === me.id} aria-label={'Xóa ' + u.username}
                          title={u.id === me.id ? 'Không thể tự xóa tài khoản của bạn' : 'Xóa tài khoản'}><Icon n="trash" size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
      {edit && <EditUser u={edit} me={me} onClose={() => setEdit(null)} onSaved={() => { if (edit.id === me.id) onSelfChange?.(); setEdit(null); load() }} />}
    </div>
  )
}
