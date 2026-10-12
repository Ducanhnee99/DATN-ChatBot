import { Fragment, useEffect, useState } from 'react'

/* Danh sách ngành – khớp với thư mục data/docs/<ma_nganh> */
export const MAJORS = [
  ['chung', 'Chung toàn trường'],
  ['cntt', 'Công nghệ thông tin'],
  ['cokhi', 'Cơ khí'],
  ['ktxd', 'Kiến trúc – Kỹ thuật xây dựng'],
  ['qlxd', 'Kinh tế – Quản lý xây dựng'],
  ['vtkt', 'Vận tải – Kinh tế'],
  ['dtqt', 'Đào tạo quốc tế'],
]
export const majorName = (m) => (MAJORS.find(([k]) => k === m) || [m, m || 'Tất cả ngành'])[1]

const P = {
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  send: 'M12 19V5M5 12l7-7 7 7',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11',
  shield: 'M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z',
  sun: 'M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M5.6 18.4l1.1-1.1M17.3 6.7l1.1-1.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  check: 'M5 12l5 5 9-10',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  refresh: 'M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4',
  users: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z',
  help: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  ban: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM5 5l14 14',
  db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3ZM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  x: 'M6 6l12 12M18 6 6 18',
  cap: 'M2 9l10-5 10 5-10 5L2 9ZM6 11.5V16c0 1 2.7 3 6 3s6-2 6-3v-4.5M22 9v5',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5ZM4 21h15',
  rule: 'M9 4h6M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M8 11h8M8 15h5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeoff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-4M12 8h.01',
  chevron: 'M9 6l6 6-6 6',
  layers: 'M12 3 2 8l10 5 10-5-10-5ZM2 13l10 5 10-5M2 17.5l10 5 10-5',
  edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2ZM7 11V7a5 5 0 0 1 10 0v4',
  unlock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2ZM7 11V7a5 5 0 0 1 9.9-1',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
}

export function Icon({ n, size = 18, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[n]} />
    </svg>
  )
}

export function Logo({ size = 36 }) {
  return <span className="logo" style={{ width: size, height: size }}><Icon n="cap" size={Math.round(size * 0.58)} /></span>
}

export function Avatar({ name = '?', size = 34 }) {
  const hue = [...name].reduce((h, c) => h + c.charCodeAt(0), 0) % 360
  return (
    <span className="avatar" style={{ width: size, height: size, background: `hsl(${hue} 55% 46%)` }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('utc_theme') || 'auto')
  const sysDark = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'auto' && sysDark)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('utc_theme', theme)
  }, [theme, dark])
  return [dark, () => setTheme(dark ? 'light' : 'dark')]
}

/* Thông báo nổi (toast) */
let pushToast = () => {}
export const toast = (text, type = 'ok') => pushToast({ text, type, id: Math.random() })
export function Toaster() {
  const [list, setList] = useState([])
  useEffect(() => {
    pushToast = (t) => {
      setList((l) => [...l, t])
      setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 3800)
    }
  }, [])
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={'toast ' + t.type}>
          <Icon n={t.type === 'err' ? 'alert' : t.type === 'info' ? 'info' : 'check'} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}

/* Markdown rút gọn: **đậm**, `code`, [1] trích dẫn, danh sách, tiêu đề, đoạn văn */
function inline(t) {
  return t.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g).map((s, i) => {
    if (/^\*\*[^*]+\*\*$/.test(s)) return <strong key={i}>{s.slice(2, -2)}</strong>
    if (/^`[^`]+`$/.test(s)) return <code key={i}>{s.slice(1, -1)}</code>
    if (/^\[\d+\]$/.test(s)) return <sup key={i} className="cite">{s.slice(1, -1)}</sup>
    return <Fragment key={i}>{s}</Fragment>
  })
}

export function Md({ text }) {
  const blocks = []
  let list = null
  const flush = () => { if (list) { blocks.push(list); list = null } }
  String(text || '').split('\n').forEach((line) => {
    const li = line.match(/^\s*(?:[-*•+]|(\d+)[.)])\s+(.*)$/)
    const h = line.match(/^#{1,4}\s+(.*)$/)
    if (li) {
      const ordered = !!li[1]
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] } }
      list.items.push(li[2])
    } else {
      flush()
      if (h) blocks.push({ h: h[1] })
      else if (line.trim()) blocks.push({ p: line })
    }
  })
  flush()
  return blocks.map((b, i) => {
    if (b.h !== undefined) return <h4 key={i}>{inline(b.h)}</h4>
    if (b.p !== undefined) return <p key={i}>{inline(b.p)}</p>
    const Tag = b.ordered ? 'ol' : 'ul'
    return <Tag key={i}>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</Tag>
  })
}
