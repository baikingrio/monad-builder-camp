import { createPublicClient, http, type Hex } from 'viem'
import { defineChain } from 'viem'

const ADDRESS = /^0x[a-fA-F0-9]{40}$/

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NUXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz']
    }
  }
})

/**
 * Server-side eth_getCode only. Avoids browser CORS / mixed-origin failures against the public RPC.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const address = typeof query.address === 'string' ? query.address : ''
  if (!ADDRESS.test(address)) {
    setResponseStatus(event, 400)
    return { kind: 'unavailable' as const, chainId: 10143 as const, reason: 'invalid-address' }
  }

  const config = useRuntimeConfig()
  const rpcUrl = (config.public.monadRpcUrl as string) || monadTestnet.rpcUrls.default.http[0]
  const client = createPublicClient({
    chain: monadTestnet,
    transport: http(rpcUrl, { timeout: 15_000 })
  })

  try {
    const code = await client.getCode({ address: address as `0x${string}` }) as Hex | undefined
    if (!code || code === '0x') return { kind: 'not-deployed' as const, chainId: 10143 as const }
    if (typeof code === 'string' && code.length > 2) return { kind: 'deployed' as const, chainId: 10143 as const }
    return { kind: 'unavailable' as const, chainId: 10143 as const, reason: 'empty-response' }
  } catch (error) {
    setResponseStatus(event, 502)
    return {
      kind: 'unavailable' as const,
      chainId: 10143 as const,
      reason: error instanceof Error ? error.message : 'rpc-failed'
    }
  }
})
