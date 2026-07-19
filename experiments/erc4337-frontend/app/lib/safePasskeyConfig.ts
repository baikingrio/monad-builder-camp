export const SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com'
export const SEPOLIA_PAYMASTER_ADDRESS = '0x0000000000325602a77416A16136FDafd04b299f'
export const SAFE_PASSKEY_NFT_ADDRESS = '0xBb9ebb7b8Ee75CDBf64e5cE124731A89c2BC4A07'

export type SafePasskeyReadiness =
  | { ready: false; message: string }
  | { ready: true; bundlerUrl: string; paymasterUrl: string }

export function getSafePasskeyReadiness(pimlicoApiKey: string | undefined): SafePasskeyReadiness {
  if (!pimlicoApiKey?.trim()) {
    return {
      ready: false,
      message: '请先在 .env 设置 NUXT_PUBLIC_PIMLICO_API_KEY，才可部署 Safe 或 Mint NFT。'
    }
  }

  const params = new URLSearchParams([
    ['add_balance_override', ''],
    ['apikey', pimlicoApiKey.trim()]
  ])
  const query = params.toString()

  return {
    ready: true,
    bundlerUrl: `https://api.pimlico.io/v1/sepolia/rpc?${query}`,
    paymasterUrl: `https://api.pimlico.io/v2/sepolia/rpc?${query}`
  }
}
