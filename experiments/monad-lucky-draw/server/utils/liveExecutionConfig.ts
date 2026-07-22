import { isAddress, type Address } from 'viem'

const MONAD_TESTNET_CHAIN_ID = 10143 as const
const PIMLICO_BASE_URL = `https://api.pimlico.io/v2/${MONAD_TESTNET_CHAIN_ID}/rpc`

export interface LiveExecutionConfigInput {
  readonly enabled: boolean
  readonly apiKey: string
  readonly sessionSecret: string
  readonly rpcUrl: string
  readonly maxGas: string
  readonly totalBudget: string
  readonly safe4337Module: string
}

export interface LiveExecutionConfig {
  readonly enabled: true
  readonly chainId: typeof MONAD_TESTNET_CHAIN_ID
  readonly rpcUrl: string
  readonly maxGas: bigint
  readonly totalBudget: bigint
  readonly safe4337Module: Address
  /** Private URL factory; the URL and credential must never be serialized to a browser response. */
  readonly createBundlerUrl: () => string
}

function requirePositiveInteger(name: string, value: string): bigint {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error(`${name} must be a positive integer`)
  return BigInt(value)
}

/**
 * Establishes the server-only prerequisite gate for actual ERC-4337 execution.
 * The returned object deliberately holds the Pimlico credential in a closure rather
 * than in serializable configuration state.
 */
export function createLiveExecutionConfig(input: LiveExecutionConfigInput): LiveExecutionConfig {
  if (input.enabled !== true) throw new Error('live execution requires an explicit enabled flag')
  if (!input.apiKey) throw new Error('live execution requires a Pimlico credential')
  if (input.sessionSecret.length < 32) throw new Error('live execution requires a durable session secret')
  if (!/^https:\/\//.test(input.rpcUrl)) throw new Error('live execution requires an HTTPS Monad RPC URL')
  if (!isAddress(input.safe4337Module)) throw new Error('live execution requires a Safe4337 module address')

  const maxGas = requirePositiveInteger('live execution max gas', input.maxGas)
  const totalBudget = requirePositiveInteger('live execution total budget', input.totalBudget)
  const apiKey = input.apiKey

  return Object.freeze({
    enabled: true,
    chainId: MONAD_TESTNET_CHAIN_ID,
    rpcUrl: input.rpcUrl,
    maxGas,
    totalBudget,
    safe4337Module: input.safe4337Module as Address,
    createBundlerUrl: () => `${PIMLICO_BASE_URL}?apikey=${encodeURIComponent(apiKey)}`
  })
}
