import { createPublicClient, http, type Hex } from 'viem'
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
  | Readonly<{ kind: 'unavailable'; chainId: 10143 }>

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
    if (code === '0x') return { kind: 'not-deployed', chainId: 10143 }
    if (typeof code === 'string' && code.length > 2) return { kind: 'deployed', chainId: 10143 }
    return { kind: 'unavailable', chainId: 10143 }
  } catch {
    return { kind: 'unavailable', chainId: 10143 }
  }
}

// Creating a viem client is inert: it does not make an RPC request. getCode is
// called only from getMonadSafeDeploymentStatus, which the page invokes on click.
const monadPublicClient = createPublicClient({
  chain: MONAD_TESTNET_CHAIN,
  transport: http(MONAD_TESTNET_CHAIN.rpcUrls.default.http[0])
})

export function getMonadSafeDeploymentStatus(address: string): Promise<SafeDeploymentStatus> {
  return checkMonadSafeDeploymentStatus(address, async ({ address: safeAddress }) => monadPublicClient.getCode({ address: safeAddress }))
}
