/** Strip credentials and long RPC dumps from errors returned to the browser. */
export function sanitizeActivationError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const withoutKey = raw
    .replace(/apikey=[^&\s"']+/gi, 'apikey=REDACTED')
    .replace(/pim_[A-Za-z0-9]+/g, 'pim_REDACTED')
  const aa23 = withoutKey.match(/AA\d{2}[^.\n]*/i)
  if (aa23) return `赞助模拟失败：${aa23[0].trim()}`
  if (/RPC Request failed/i.test(withoutKey)) {
    const details = withoutKey.match(/Details:\s*([^\n]+)/i)
    return details ? `赞助模拟失败：${details[1].trim()}` : '赞助模拟失败：RPC 请求失败'
  }
  return withoutKey.length > 280 ? `${withoutKey.slice(0, 280)}…` : withoutKey
}
