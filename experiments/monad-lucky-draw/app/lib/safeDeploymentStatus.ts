import type { Hex } from 'viem'
import type { EthereumAddress } from './authMessage'

/** The only network accepted for this read-only deployment lookup. */
export const MONAD_TESTNET_CHAIN = Object.freeze({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
})

export type SafeDeploymentStatus =
  | Readonly<{ kind: 'deployed'; chainId: 10143 }>
  | Readonly<{ kind: 'not-deployed'; chainId: 10143 }>
  | Readonly<{ kind: 'unavailable'; chainId: 10143; reason?: string }>

/** Injectable eth_getCode boundary; callers cannot provide a different chain target. */
export type MonadGetCode = (request: Readonly<{
  address: EthereumAddress
  chain: typeof MONAD_TESTNET_CHAIN
}>) => Promise<Hex | undefined>

const ETHEREUM_ADDRESS = /^0x[a-fA-F0-9]{40}$/

/**
 * Classifies exactly one eth_getCode result. This is read-only and performs no
 * request until its injected getCode function is called by an explicit UI action.
 */
export async function checkMonadSafeDeploymentStatus(address: string, getCode: MonadGetCode): Promise<SafeDeploymentStatus> {
  if (!ETHEREUM_ADDRESS.test(address)) throw new Error('Safe address must be a 20-byte Ethereum address')

  try {
    const code = await getCode({ address: address as EthereumAddress, chain: MONAD_TESTNET_CHAIN })
    // Viem may return '0x' or undefined for accounts with no bytecode.
    if (!code || code === '0x') return { kind: 'not-deployed', chainId: 10143 }
    if (typeof code === 'string' && code.length > 2) return { kind: 'deployed', chainId: 10143 }
    return { kind: 'unavailable', chainId: 10143, reason: 'empty-response' }
  } catch (error) {
    return {
      kind: 'unavailable',
      chainId: 10143,
      reason: error instanceof Error ? error.message : 'rpc-failed'
    }
  }
}

/**
 * Browser entry: asks the Nuxt server to perform eth_getCode so the page never
 * depends on public-RPC CORS from the user's Origin.
 */
export async function getMonadSafeDeploymentStatus(address: string): Promise<SafeDeploymentStatus> {
  if (!ETHEREUM_ADDRESS.test(address)) throw new Error('Safe address must be a 20-byte Ethereum address')
  try {
    const response = await $fetch<SafeDeploymentStatus>('/api/draw/safe-deployment', {
      query: { address }
    })
    if (response?.kind === 'deployed' || response?.kind === 'not-deployed' || response?.kind === 'unavailable') {
      return response
    }
    return { kind: 'unavailable', chainId: 10143, reason: 'invalid-server-response' }
  } catch (error) {
    return {
      kind: 'unavailable',
      chainId: 10143,
      reason: error instanceof Error ? error.message : 'rpc-failed'
    }
  }
}
