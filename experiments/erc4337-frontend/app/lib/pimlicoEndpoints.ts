/** Pimlico v2 RPC（numeric chain id 与文档 slug 均可；Monad 用 slug 与 Dashboard 命名一致）。 */
export function buildPimlicoV2RpcUrl(chainPath: string | number, apiKey: string): string {
  const key = apiKey.trim()
  const segment = String(chainPath)
  // Safe 教程 flag：无 `=`，与 Sepolia 相同，便于 counterfactual Safe 估 gas。
  return `https://api.pimlico.io/v2/${segment}/rpc?add_balance_override&apikey=${encodeURIComponent(key)}`
}

export const PIMLICO_SEPOLIA_CHAIN = 11155111
export const PIMLICO_MONAD_TESTNET_CHAIN = 'monad-testnet' as const

export type PimlicoProbeResult =
  | { ok: true; chainIdHex?: string }
  | { ok: false; httpStatus: number; hint: string }

/** 用 eth_chainId 探测 API Key 是否允许当前链（浏览器端，不泄露 key）。 */
export async function probePimlicoRpc(bundlerUrl: string): Promise<PimlicoProbeResult> {
  try {
    const res = await fetch(bundlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] })
    })
    const text = await res.text()
    if (res.status === 401) {
      return {
        ok: false,
        httpStatus: 401,
        hint: 'Pimlico API Key 无效或未写入 .env；修改后请重启 npm run dev。'
      }
    }
    if (res.status === 403) {
      return {
        ok: false,
        httpStatus: 403,
        hint: parsePimlico403Hint(text)
      }
    }
    if (!res.ok) {
      return { ok: false, httpStatus: res.status, hint: text.slice(0, 240) || `HTTP ${res.status}` }
    }
    let chainIdHex: string | undefined
    try {
      const json = JSON.parse(text) as { result?: string }
      chainIdHex = json.result
    } catch {
      /* ignore */
    }
    return { ok: true, chainIdHex }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, httpStatus: 0, hint: message }
  }
}

function parsePimlico403Hint(body: string): string {
  try {
    const json = JSON.parse(body) as { message?: string }
    const msg = json.message ?? ''
    if (/chain.*not supported/i.test(msg)) {
      return '该 API Key 未启用目标链。在 Pimlico Dashboard → API Keys → 编辑 Key → 勾选 Monad Testnet（monad-testnet / 10143），保存后重启 dev。'
    }
    if (/origin|referer|cors/i.test(msg)) {
      return '来源被拒绝：在 API Key 的 Allowed origins 中加入 http://localhost:3000（以及你实际访问的前端 URL）。'
    }
  } catch {
    /* ignore */
  }
  return [
    'Pimlico 返回 403（Key 可能仅开通了 Sepolia 等其它链）。',
    '请在 Dashboard 同一 API Key 下启用 Monad Testnet，Allowed origins 含 http://localhost:3000，',
    '并配置 Verifying Paymaster / Sponsorship policy 覆盖 10143。',
    '端点格式：https://api.pimlico.io/v2/monad-testnet/rpc?add_balance_override&apikey=…'
  ].join('')
}

export function formatPimlicoProbeFailure(result: Extract<PimlicoProbeResult, { ok: false }>): string {
  return result.hint
}
