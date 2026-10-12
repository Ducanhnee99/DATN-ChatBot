import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { Icon, MAJORS, majorName, toast } from './ui'

const fmtSize = (kb) => (kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB')
const ext = (n) => (n.split('.').pop() || '').toLowerCase()

export default function Admin() {
  const [stats, setStats] = useState(null)
  const [docs, setDocs] = useState([])
  const [major, setMajor] = useState('chung')
  const [busy, setBusy] = useState('')
  const [drag, setDrag] = useState(false)
  const [kw, setKw] = useState('')
  const [fm, setFm] = useState('')
  const file = useRef()

  const load = () => Promise.all([api('/admin/stats'), api('/admin/docs')])
    .then(([s, d]) => { setStats(s); setDocs(d) }).catch((e) => toast(e.message, 'err'))
  useEffect(() => { load() }, [])

  const act = async (label, fn, done) => {
    setBusy(label)
    try { const r = await fn(); toast(done + (r?.chunks != null ? ` · ${r.chunks} đoạn trong kho tri thức` : '')) }
    catch (e) { toast(e.message, 'err') }
    finally { setBusy(''); load() }
  }
  const upload = (f) => {
    if (!f) return
    if (!/\.(pdf|docx|txt|md)$/i.test(f.name)) return toast('Chỉ hỗ trợ tệp PDF, DOCX, TXT, MD', 'err')
    const fd = new FormData(); fd.append('file', f); fd.append('major', major)
    act(`Đang tải lên “${f.name}” và dựng lại chỉ mục…`, () => api('/admin/upload', { method: 'POST', form: fd }), 'Đã thêm tài liệu ' + f.name)
  }
  const remove = (d) => {
    if (!confirm(`Xóa tài liệu “${d.name}” khỏi kho tri thức?`)) return
    act(`Đang xóa “${d.name}” và dựng lại chỉ mục…`, () => api(`/admin/docs/${d.major}/${encodeURIComponent(d.name)}`, { method: 'DELETE' }), 'Đã xóa ' + d.name)
  }

  const majors = useMemo(() => [...new Set([...MAJORS.map(([k]) => k), ...docs.map((d) => d.major)])], [docs])
  const byMajor = useMemo(() => docs.reduce((a, d) => ({ ...a, [d.major]: (a[d.major] || 0) + 1 }), {}), [docs])
  const shown = docs.filter((d) => (!fm || d.major === fm) && d.name.toLowerCase().includes(kw.toLowerCase()))
  const totalKb = docs.reduce((s, d) => s + d.kb, 0)
  const answered = stats ? Math.max(stats.questions - stats.refused, 0) : 0
  const rate = stats?.questions ? Math.round((answered / stats.questions) * 100) : 0

  const cards = stats ? [
    ['users', 'Người dùng', stats.users, 'blue'],
    ['chat', 'Cuộc trò chuyện', stats.conversations, 'violet'],
    ['help', 'Câu hỏi đã nhận', stats.questions, 'teal'],
    ['ban', 'Câu bị từ chối', stats.refused, 'amber'],
    ['db', 'Đoạn tri thức (chunk)', stats.chunks, 'rose'],
  ] : []

  return (
    <div className="admin">
      <div className="admin-inner">
        {busy && <div className="busy-bar"><span className="spin" /> {busy}<i /></div>}

        <section>
          <div className="sec-head"><div><h2>Tổng quan</h2><p className="muted">Số liệu hoạt động của hệ thống chatbot.</p></div>
            <button className="btn" onClick={load} disabled={!!busy}><Icon n="refresh" size={16} /> Làm mới</button></div>
          <div className="stats">
            {!stats && [1, 2, 3, 4, 5].map((i) => <div key={i} className="stat skel" />)}
            {cards.map(([i, k, v, c]) => (
              <div key={k} className={'stat ' + c}>
                <span className="stat-ico"><Icon n={i} size={20} /></span>
                <b>{Number(v).toLocaleString('vi-VN')}</b>
                <small>{k}</small>
              </div>
            ))}
          </div>
          {stats && (
            <div className="rate card">
              <div className="rate-head"><b>Tỷ lệ trả lời được</b><span><b>{rate}%</b> <small className="muted">({answered}/{stats.questions} câu hỏi)</small></span></div>
              <div className="meter"><i style={{ width: rate + '%' }} /></div>
              <small className="muted">Câu bị từ chối là câu không tìm thấy đoạn tài liệu đủ liên quan (ngưỡng <code>MIN_RERANK</code> / <code>MIN_COS</code>) — hệ thống chủ động không trả lời để tránh bịa thông tin.</small>
            </div>
          )}
        </section>

        <section>
          <div className="sec-head"><div><h2>Kho tri thức</h2><p className="muted">{docs.length} tài liệu · {fmtSize(Math.round(totalKb * 10) / 10)} · {Object.keys(byMajor).length} nhóm ngành</p></div>
            <button className="btn" disabled={!!busy} onClick={() => act('Đang dựng lại chỉ mục…', () => api('/admin/reindex', { method: 'POST' }), 'Đã dựng lại chỉ mục')}>
              <Icon n="refresh" size={16} /> Dựng lại chỉ mục</button></div>

          <div className="upload card">
            <label className="field">
              <span>Ngành của tài liệu</span>
              <input list="majors" value={major} onChange={(e) => setMajor(e.target.value)} disabled={!!busy} />
              <datalist id="majors">{majors.map((m) => <option key={m} value={m}>{majorName(m)}</option>)}</datalist>
              <small className="muted">{majorName(major)}{major === 'chung' ? ' – áp dụng cho mọi sinh viên' : ''}</small>
            </label>
            <div className={'drop' + (drag ? ' over' : '') + (busy ? ' dis' : '')}
              onClick={() => !busy && file.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); !busy && upload(e.dataTransfer.files[0]) }}
              role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && file.current.click()}>
              <span className="drop-ico"><Icon n="upload" size={24} /></span>
              <b>Kéo thả tệp vào đây hoặc <u>chọn tệp</u></b>
              <small className="muted">Hỗ trợ PDF, DOCX, TXT, MD · Hệ thống tự phân đoạn theo Điều và dựng lại chỉ mục</small>
              <input ref={file} type="file" hidden accept=".pdf,.docx,.txt,.md" onChange={(e) => { upload(e.target.files[0]); e.target.value = '' }} />
            </div>
          </div>

          <div className="chips">
            <button className={!fm ? 'on' : ''} onClick={() => setFm('')}>Tất cả <em>{docs.length}</em></button>
            {Object.entries(byMajor).map(([m, n]) => (
              <button key={m} className={fm === m ? 'on' : ''} onClick={() => setFm(m)}>{majorName(m)} <em>{n}</em></button>
            ))}
          </div>

          <div className="card table-card">
            <div className="table-tools">
              <div className="sb-search"><Icon n="search" size={16} /><input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Tìm tài liệu theo tên…" /></div>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Tài liệu</th><th>Ngành</th><th className="r">Dung lượng</th><th /></tr></thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr><td colSpan="4" className="empty-row">
                      <Icon n="file" size={28} /><div>{docs.length ? 'Không có tài liệu phù hợp bộ lọc.' : 'Chưa có tài liệu. Tải tệp PDF, DOCX hoặc TXT lên để bắt đầu.'}</div>
                    </td></tr>
                  )}
                  {shown.map((d) => (
                    <tr key={d.major + d.name}>
                      <td><div className="doc"><span className={'ext ' + ext(d.name)}>{ext(d.name)}</span><span className="doc-name" title={d.name}>{d.name}</span></div></td>
                      <td><span className="tag">{majorName(d.major)}</span></td>
                      <td className="r muted">{fmtSize(d.kb)}</td>
                      <td className="r"><button className="icon-btn danger" disabled={!!busy} onClick={() => remove(d)} aria-label={'Xóa ' + d.name} title="Xóa tài liệu"><Icon n="trash" size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
