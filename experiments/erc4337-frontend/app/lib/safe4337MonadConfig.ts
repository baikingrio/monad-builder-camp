export const MONAD_TESTNET_CHAIN_ID = 10143
export const MONAD_ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'
export const MONAD_SAFE_4337_MODULE = '0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226'
export const MONAD_SAFE_V141 = '0x41675C099F32341bf84BFc5382aF534df5C7461a'

export type MonadSafe4337Readiness =
  | { ready: false; message: string }
  | { ready: true; bundlerUrl: string; paymasterUrl: string }

export function getMonadSafe4337Readiness(pimlicoApiKey: string | undefined): MonadSafe4337Readiness {
  if (!pimlicoApiKey?.trim()) {
    return {
      ready: false,
      message: '请先设置 NUXT_PUBLIC_MONAD_PIMLICO_API_KEY，才可发送 Monad Safe UserOperation。'
    }
  }

  const query = new URLSearchParams([['apikey', pimlicoApiKey.trim()]]).toString()
  const endpoint = `https://api.pimlico.io/v2/10143/rpc?${query}`
  return { ready: true, bundlerUrl: endpoint, paymasterUrl: endpoint }
}
