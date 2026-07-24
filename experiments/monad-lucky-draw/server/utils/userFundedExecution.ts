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

/** Format wei as a short MON string for user-facing deposit errors. */
export function formatMonFromWei(wei: bigint): string {
  const whole = wei / 10n ** 18n
  const frac = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '')
  return frac ? `${whole.toString()}.${frac}` : whole.toString()
}

export function assertSufficientEntryPointDeposit(input: { readonly deposit: bigint; readonly userOperation: GasCostUserOperation }): void {
  const required = conservativeUserOperationCost(input.userOperation)
  if (input.deposit < required) {
    const shortfall = required - input.deposit
    throw new Error(
      `insufficient EntryPoint deposit: ${formatMonFromWei(input.deposit)} MON available, ${formatMonFromWei(required)} MON required (还差约 ${formatMonFromWei(shortfall)} MON，请在下方充值后重试)`
    )
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

/** Read-only, serializable deposit + Safe native balance. The EntryPoint is fixed; no RPC endpoint is exposed. */
export async function getUserFundingStatus(input: {
  readonly safe: string
  readonly readBalance: EntryPointBalanceReader
  readonly readNativeBalance?: (safe: string) => Promise<bigint>
}) {
  if (!isAddress(input.safe) || input.safe.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    throw new Error('a valid Safe is required')
  }
  const deposit = await input.readBalance({ entryPoint: MONAD_ACTIVATION_CONFIG.entryPoint, safe: input.safe })
  const nativeBalance = input.readNativeBalance
    ? await input.readNativeBalance(input.safe)
    : undefined
  return Object.freeze({
    entryPoint: MONAD_ACTIVATION_CONFIG.entryPoint,
    safe: input.safe,
    deposit: deposit.toString(),
    ...(nativeBalance === undefined ? {} : { nativeBalance: nativeBalance.toString() })
  })
}

export function createNativeBalanceReader(rpcUrl = monadTestnet.rpcUrls.default.http[0]): (safe: string) => Promise<bigint> {
  const client = createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) })
  return async (safe) => client.getBalance({ address: safe as Address })
}
