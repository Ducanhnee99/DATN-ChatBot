const KEY = 'utc_token'
export const getToken = () => localStorage.getItem(KEY)
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY))

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const tok = getToken()
  if (tok) headers.Authorization = 'Bearer ' + tok
  if (body) headers['Content-Type'] = 'application/json'
  const r = await fetch('/api' + path, { method, headers, body: form || (body && JSON.stringify(body)) })
  if (r.status === 401 && tok) {
    setToken(null)
  }
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.detail || 'Lỗi ' + r.status)
  return j
}
