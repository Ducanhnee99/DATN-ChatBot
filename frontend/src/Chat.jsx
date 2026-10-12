import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { Icon, Logo, Md, toast, majorName } from './ui'

const SUGGEST_GENERAL = [
  ['rule', 'Cảnh báo học vụ', 'Sinh viên bị cảnh báo học vụ khi nào?'],
  ['cap', 'Xét tốt nghiệp', 'Điều kiện để được xét công nhận tốt nghiệp là gì?'],
  ['help', 'Điểm F & học lại', 'Sinh viên bị điểm F thì xử lý thế nào?'],
  ['book', 'Các ngành đào tạo', 'Trường Đại học Giao thông Vận tải đào tạo những ngành gì?'],
]

const SUGGEST_MAJORS = [
  ['spark', 'Ngành Công nghệ thông tin', 'Chương trình đào tạo ngành Công nghệ thông tin gồm những môn gì?', 'cntt'],
  ['book', 'Học phần IT3080', 'Học phần IT3080 học trước môn nào?', 'cntt'],
  ['cap', 'Ngành Kỹ thuật Xây dựng', 'Ngành Kỹ thuật xây dựng cần bao nhiêu tín chỉ để tốt nghiệp?', 'ktxd'],
  ['spark', 'Ngành Cơ khí – Ô tô', 'Lộ trình và chuẩn đầu ra ngành Cơ khí như thế nào?', 'cokhi'],
]

const isRefusal = (m) => m.route === 'refused' || /^Mình chưa tìm thấy thông tin/.test(m.content || '')

function uniqSources(src = []) {
  const seen = new Set()
  return (src || []).filter((s) => {
    const k = s.source + '|' + s.page
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function Sources({ list }) {
  const [open, setOpen] = useState(false)
  const src = uniqSources(list)
  if (!src.length) return null
  return (
    <div className={'sources' + (open ? ' open' : '')}>
      <button className="src-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon n="book" size={15} /> {src.length} nguồn tham khảo <Icon n="chevron" size={14} className="chev" />
      </button>
      {open && (
        <ol className="src-list">
          {src.map((s, j) => (
            <li key={j}>
              <span className="src-n">{j + 1}</span>
              <Icon n="file" size={16} />
              <div>
                <b>{String(s.source).replace(/\.(pdf|docx|txt|md|csv)$/i, '')}</b>
                <small>{s.page && s.page !== '-' ? 'Trang ' + s.page : 'Dữ liệu bảng'}{s.section ? ' · ' + s.section : ''}</small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Message({ m, onRetry, onOpenAuth }) {
  const [copied, setCopied] = useState(false)
  if (m.role === 'user') return <div className="row user"><div className="bubble">{m.content}</div></div>

  const refused = isRefusal(m)
  const isAuthRequired = m.route === 'auth_required'
  const copy = () => {
    navigator.clipboard?.writeText(m.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="row bot">
      <Logo size={32} />
      <div className="bot-body">
        <div className={'bubble' + (refused ? ' refused' : '') + (isAuthRequired ? ' auth-required' : '') + (m.error ? ' error' : '')}>
          {refused && (
            <div className="refused-tag"><Icon n="info" size={15} /> Ngoài phạm vi tài liệu hiện có</div>
          )}
          {isAuthRequired && (
            <div className="auth-required-tag"><Icon n="lock" size={15} /> Giới hạn chế độ Khách · Yêu cầu đăng nhập</div>
          )}
          {m.error ? (
            <>
              <div className="refused-tag"><Icon n="alert" size={15} /> Không thể kết nối tới máy chủ</div>
              <p>{m.content}</p>
            </>
          ) : (
            <div className="md"><Md text={m.content} /></div>
          )}

          {isAuthRequired && (
            <div className="auth-cta-card">
              <div className="auth-cta-head">
                <span className="auth-cta-badge"><Icon n="spark" size={14} /> Mở khóa dữ liệu ngành</span>
                <b>Đăng ký tài khoản sinh viên UTC</b>
              </div>
              <p className="auth-cta-desc">
                Đăng nhập hoặc tạo tài khoản mới để tra cứu chi tiết mọi học phần, số tín chỉ, tiên quyết và toàn bộ chương trình đào tạo của ngành!
              </p>
              <div className="auth-cta-btns">
                <button type="button" className="btn primary sm" onClick={() => onOpenAuth?.('login')}>
                  <Icon n="users" size={15} /> Đăng nhập ngay
                </button>
                <button type="button" className="btn sm" onClick={() => onOpenAuth?.('register', m.target_major)}>
                  <Icon n="spark" size={15} /> Tạo tài khoản miễn phí
                </button>
              </div>
            </div>
          )}
        </div>

        {!m.error && !isAuthRequired && <Sources list={m.sources} />}

        <div className="msg-actions">
          {m.error ? (
            <button onClick={onRetry}><Icon n="refresh" size={15} /> Thử lại</button>
          ) : (
            <button onClick={copy} aria-label="Sao chép câu trả lời">
              <Icon n={copied ? 'check' : 'copy'} size={15} /> {copied ? 'Đã chép' : 'Sao chép'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Chat({ cid, onCid, onChanged, user, onOpenAuth }) {
  const [msgs, setMsgs] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const skip = useRef(false)
  const end = useRef()
  const ta = useRef()

  useEffect(() => {
    if (skip.current) { skip.current = false; return }
    if (!cid) { setMsgs([]); return }
    setLoading(true)
    api('/conversations/' + cid)
      .then(setMsgs)
      .catch((e) => toast(e.message, 'err'))
      .finally(() => setLoading(false))
  }, [cid])

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, busy])

  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [q])

  const send = async (raw) => {
    const text = (raw ?? q).trim()
    if (!text || busy) return
    setQ('')
    setBusy(true)
    setMsgs((m) => [...m.filter((x) => !x.error), { role: 'user', content: text }])

    const body = { question: text, conversation_id: cid }
    if (!user) {
      body.history = msgs.slice(-6)
    }

    try {
      const r = await api('/chat', { method: 'POST', body })
      if (r.conversation_id && r.conversation_id !== cid) {
        skip.current = true
        onCid?.(r.conversation_id)
      }
      setMsgs((m) => [
        ...m,
        {
          role: 'assistant',
          content: r.answer,
          sources: r.sources,
          route: r.route,
          target_major: r.target_major,
        },
      ])
      if (onChanged) onChanged()
    } catch (x) {
      setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', error: true, content: x.message, retry: text }])
    } finally {
      setBusy(false)
      ta.current?.focus()
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  const hello = new Date().getHours() < 12 ? 'Chào buổi sáng' : new Date().getHours() < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'

  return (
    <div className="chat">
      <div className="log">
        <div className="log-inner">
          {loading && <div className="center-load"><span className="spin dark" /> Đang tải cuộc trò chuyện…</div>}

          {!loading && msgs.length === 0 && (
            <div className="welcome">
              <Logo size={68} />
              {user ? (
                <>
                  <h2>{hello}, <span className="grad">{user.username}</span>!</h2>
                  <p className="muted">
                    Mình là Trợ lý học vụ UTC. Bạn có thể tra cứu toàn bộ quy chế đào tạo, chương trình đào tạo theo ngành, môn tiên quyết và tín chỉ.
                  </p>
                </>
              ) : (
                <>
                  <div className="guest-badge-pill">
                    <span className="pill-dot" />
                    <span>Chế độ Khách · Hỏi đáp quy chế & thông tin trường</span>
                  </div>
                  <h2>Chào mừng bạn đến với <span className="grad">Trợ lý học vụ UTC</span>!</h2>
                  <p className="muted">
                    Bạn có thể tự do hỏi các thông tin, quy chế chung toàn trường. Để tra cứu chuyên sâu theo <b>từng ngành học</b>, vui lòng đăng ký hoặc đăng nhập tài khoản nhé.
                  </p>
                </>
              )}

              <div className="suggest-sections">
                <div className="suggest-group">
                  <div className="suggest-group-header">
                    <span><Icon n="cap" size={15} /> Quy chế & Thông tin toàn trường</span>
                    <span className="suggest-group-tag">Hỏi được ngay</span>
                  </div>
                  <div className="suggest-grid">
                    {SUGGEST_GENERAL.map(([i, t, s]) => (
                      <button key={s} onClick={() => send(s)} disabled={busy} className="sg-card">
                        <span className="sg-ico"><Icon n={i} size={18} /></span>
                        <b>{t}</b>
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="suggest-group">
                  <div className="suggest-group-header">
                    <span><Icon n="spark" size={15} /> Chương trình theo từng ngành</span>
                    <span className="suggest-group-tag lock-tag">
                      <Icon n="lock" size={12} /> Cần đăng nhập
                    </span>
                  </div>
                  <div className="suggest-grid">
                    {SUGGEST_MAJORS.map(([i, t, s, major]) => (
                      <button
                        key={s}
                        onClick={() => {
                          if (!user) {
                            // Can either send to trigger bot response or directly open auth
                            send(s)
                          } else {
                            send(s)
                          }
                        }}
                        disabled={busy}
                        className="sg-card major-sg-card"
                      >
                        <span className="sg-ico major-ico">
                          <Icon n={!user ? 'lock' : i} size={17} />
                        </span>
                        <div className="sg-title-row">
                          <b>{t}</b>
                          {!user && <span className="sg-lock-badge"><Icon n="lock" size={11} /> Khóa</span>}
                        </div>
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <Message key={i} m={m} onRetry={() => send(m.retry)} onOpenAuth={onOpenAuth} />
          ))}

          {busy && (
            <div className="row bot">
              <Logo size={32} />
              <div className="bubble typing">
                <span /><span /><span />
                <em>Đang tra cứu tài liệu học vụ UTC…</em>
              </div>
            </div>
          )}
          <div ref={end} />
        </div>
      </div>

      <div className="composer-wrap">
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send() }}>
          <textarea
            ref={ta}
            rows={1}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={
              user
                ? 'Nhập câu hỏi về quy chế, chương trình đào tạo, học phần theo ngành…'
                : 'Hỏi về quy chế, tốt nghiệp, học vụ chung toàn trường (Đăng nhập để hỏi từng ngành)…'
            }
            aria-label="Câu hỏi"
            autoFocus
          />
          <button className="send" disabled={busy || !q.trim()} aria-label="Gửi câu hỏi">
            <Icon n="send" size={18} />
          </button>
        </form>
        <div className="disclaimer-row">
          <p className="disclaimer">
            {!user ? (
              <>
                🔒 Bạn đang ở <b>Chế độ Khách</b> (chỉ tra cứu tài liệu chung của trường). Muốn hỏi sâu theo ngành?{' '}
                <button type="button" className="inline-auth-btn" onClick={() => onOpenAuth?.('register')}>
                  Đăng ký tài khoản
                </button>
              </>
            ) : (
              <>Thông tin đối chiếu từ tài liệu học vụ chính thức của UTC · <kbd>Enter</kbd> gửi, <kbd>Shift + Enter</kbd> xuống dòng</>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
