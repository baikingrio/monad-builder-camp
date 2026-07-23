import { createPublicClient, defineChain, http, isAddress, type Address } from 'viem'
import { entryPointDepositAbi } from '../../app/lib/entryPointDeposit'
import { MONAD_ACTIVATION_CONFIG } from '../../app/lib/monadConfig'

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
})

export type EntryPointBalanceReader = (input: { readonly entryPoint: string; readonly safe: string }) => Promise<bigint>

export interface GasCostUserOperation {
  readonly callGasLimit: string
  readonly verificationGasLimit: string
  readonly preVerificationGas: string
  readonly maxFeePerGas: string
}

/** Includes a 20% buffer over all estimated gas units before allowing a session signature. */
export function conservativeUserOperationCost(userOperation: GasCostUserOperation): bigint {
  const gas = BigInt(userOperation.callGasLimit)
    + BigInt(userOperation.verificationGasLimit)
    + BigInt(userOperation.preVerificationGas)
  return ((gas * BigInt(userOperation.maxFeePerGas)) * 120n) / 100n
}

export function assertSufficientEntryPointDeposit(input: { readonly deposit: bigint; readonly userOperation: GasCostUserOperation }): void {
  const required = conservativeUserOperationCost(input.userOperation)
  if (input.deposit < required) {
    throw new Error(`insufficient EntryPoint deposit: ${input.deposit.toString()} available, ${required.toString()} required`)
  }
}

export function createEntryPointBalanceReader(): EntryPointBalanceReader {
  const client = createPublicClient({ chain: monadTestnet, transport: http(monadTestnet.rpcUrls.default.http[0]) })
  return async ({ entryPoint, safe }) => client.readContract({
    address: entryPoint as Address,
    abi: entryPointDepositAbi,
    functionName: 'balanceOf',
    args: [safe as Address]
  })
}

/** Read-only, serializable deposit status. The EntryPoint is fixed; no RPC endpoint is exposed. */
export async function getUserFundingStatus(input: { readonly safe: string; readonly readBalance: EntryPointBalanceReader }) {
  if (!isAddress(input.safe) || input.safe.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    throw new Error('a valid Safe is required')
  }
  const deposit = await input.readBalance({ entryPoint: MONAD_ACTIVATION_CONFIG.entryPoint, safe: input.safe })
  return Object.freeze({
    entryPoint: MONAD_ACTIVATION_CONFIG.entryPoint,
    safe: input.safe,
    deposit: deposit.toString()
  })
}
