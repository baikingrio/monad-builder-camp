/** Strip credentials and long RPC dumps from errors returned to the browser. */
export function sanitizeActivationError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const withoutKey = raw
    .replace(/apikey=[^&\s"']+/gi, 'apikey=REDACTED')
    .replace(/pim_[A-Za-z0-9]+/g, 'pim_REDACTED')
  const aa23 = withoutKey.match(/AA\d{2}[^.\n]*/i)
  if (aa23) {
    const snippet = aa23[0].trim()
    // Bundlers sometimes append huge calldata/revert blobs after AA23.
    const short = snippet.length > 120 ? `${snippet.slice(0, 120)}…` : snippet
    if (/TakenAddress|already|GS200|enableModule|deployModule/i.test(withoutKey)) {
      return `赞助模拟失败：Roles 可能已安装。请刷新后重试启用（仅赋权新 Session Key）。详情：${short}`
    }
    return `赞助模拟失败：${short}`
  }
  if (/RPC Request failed/i.test(withoutKey)) {
    const details = withoutKey.match(/Details:\s*([^\n]+)/i)
    const detail = details?.[1]?.trim() ?? 'RPC 请求失败'
    return `赞助模拟失败：${detail.length > 160 ? `${detail.slice(0, 160)}…` : detail}`
  }
  return withoutKey.length > 280 ? `${withoutKey.slice(0, 280)}…` : withoutKey
}
