/** Pimlico v2 RPC（numeric chain id 与文档 slug 均可；Monad 用 slug 与 Dashboard 命名一致）。 */
export function buildPimlicoV2RpcUrl(chainPath: string | number, apiKey: string): string {
  const key = apiKey.trim()
  const segment = String(chainPath)
  // Safe 教程 flag：无 `=`，与 Sepolia 相同，便于 counterfactual Safe 估 gas。
  return `https://api.pimlico.io/v2/${segment}/rpc?add_balance_override&apikey=${encodeURIComponent(key)}`
}

export const PIMLICO_SEPOLIA_CHAIN = 11155111
export const PIMLICO_MONAD_TESTNET_CHAIN = 'monad-testnet' as const
