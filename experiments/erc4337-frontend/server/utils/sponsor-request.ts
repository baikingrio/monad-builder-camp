import { decodeFunctionData, encodeFunctionData } from 'viem'

/** Public, untrusted inputs accepted by the private learning-only sponsor endpoint. */
export interface SponsorRequest {
  chainId: number
  sender: string
  nonce: string | number | bigint
  initCode: string
  callData: string
  /** Packed uint128 verificationGasLimit and uint128 callGasLimit. */
  accountGasLimits: string
  preVerificationGas: string | number | bigint
  /** Packed uint128 maxPriorityFeePerGas and uint128 maxFeePerGas. */
  gasFees: string
  paymaster: string
  paymasterVerificationGasLimit: string | number | bigint
  paymasterPostOpGasLimit: string | number | bigint
  /** Caller-provided metadata is checked against callData but never signed. */
  target: string
  /** Caller-provided metadata is checked against callData but never signed. */
  selector: string
}

export interface ValidatedSponsorRequest {
  chainId: typeof MONAD_TESTNET_CHAIN_ID
  sender: `0x${string}`
  nonce: bigint
  initCode: `0x${string}`
  callData: `0x${string}`
  accountGasLimits: `0x${string}`
  preVerificationGas: bigint
  gasFees: `0x${string}`
  paymaster: `0x${string}`
  paymasterVerificationGasLimit: bigint
  paymasterPostOpGasLimit: bigint
  target: `0x${string}`
  selector: `0x${string}`
  executionValue: bigint
  innerCallData: `0x${string}`
}

export interface SponsorAuthorization {
  authorization: `0x${string}`
  validUntil: number
  chainId: typeof MONAD_TESTNET_CHAIN_ID
  paymaster: `0x${string}`
}

export const MONAD_TESTNET_CHAIN_ID = 10143
/** Fixed server-derived authorization lifetime. */
export const SPONSOR_AUTHORIZATION_TTL_SECONDS = 120

/** Conservative per-authorization limits; checked before any signature is made. */
export const MAX_ACCOUNT_VERIFICATION_GAS_LIMIT = 300_000n
export const MAX_ACCOUNT_CALL_GAS_LIMIT = 500_000n
export const MAX_PRE_VERIFICATION_GAS = 100_000n
export const MAX_MAX_PRIORITY_FEE_PER_GAS = 3_000_000_000n
export const MAX_MAX_FEE_PER_GAS = 10_000_000_000n
export const MAX_PAYMASTER_VERIFICATION_GAS_LIMIT = 300_000n
export const MAX_PAYMASTER_POST_OP_GAS_LIMIT = 100_000n

export type SponsorRequestErrorCode = 'MALFORMED_REQUEST' | 'WRONG_CHAIN' | 'COST_LIMIT_EXCEEDED'
export type SponsorRequestParseResult =
  | { ok: true, value: ValidatedSponsorRequest }
  | { ok: false, error: { code: SponsorRequestErrorCode } }

const UINT128_MAX = (1n << 128n) - 1n
const UINT256_MAX = (1n << 256n) - 1n
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const HEX_PATTERN = /^0x(?:[0-9a-fA-F]{2})*$/
const SELECTOR_PATTERN = /^0x[0-9a-fA-F]{8}$/
const ACCOUNT_EXECUTION_ABI = [{
  type: 'function', name: 'execute',
  inputs: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }],
  outputs: [{ name: 'result', type: 'bytes' }], stateMutability: 'nonpayable'
}] as const

function failure(code: SponsorRequestErrorCode): SponsorRequestParseResult { return { ok: false, error: { code } } }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function isAddress(value: unknown): value is `0x${string}` { return typeof value === 'string' && ADDRESS_PATTERN.test(value) }
function isHex(value: unknown): value is `0x${string}` { return typeof value === 'string' && HEX_PATTERN.test(value) }
function isBytes32(value: unknown): value is `0x${string}` { return isHex(value) && value.length === 66 }
function parseUnsigned(value: unknown, max: bigint): bigint | undefined {
  const parsed = typeof value === 'bigint' ? value
    : typeof value === 'number' && Number.isSafeInteger(value) ? BigInt(value)
      : typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/.test(value) ? BigInt(value) : undefined
  return parsed !== undefined && parsed >= 0n && parsed <= max ? parsed : undefined
}

function decodeAccountExecutionCall(callData: `0x${string}`): { target: `0x${string}`, selector: `0x${string}`, value: bigint, data: `0x${string}` } | undefined {
  try {
    const decoded = decodeFunctionData({ abi: ACCOUNT_EXECUTION_ABI, data: callData })
    if (decoded.functionName !== 'execute') return undefined
    const [target, value, data] = decoded.args
    if (data.length < 10) return undefined
    const canonical = encodeFunctionData({ abi: ACCOUNT_EXECUTION_ABI, functionName: 'execute', args: [target, value, data] })
    if (canonical.toLowerCase() !== callData.toLowerCase()) return undefined
    return { target, value, data, selector: data.slice(0, 10) as `0x${string}` }
  } catch { return undefined }
}

/** Parses only public input. Expiry is deliberately absent: the signer derives it server-side. */
export function parseSponsorRequest(input: unknown): SponsorRequestParseResult {
  if (!isRecord(input)) return failure('MALFORMED_REQUEST')
  if (input.chainId !== MONAD_TESTNET_CHAIN_ID) return failure('WRONG_CHAIN')
  if (!isAddress(input.sender) || !isHex(input.initCode) || !isHex(input.callData) || input.callData === '0x' || !isBytes32(input.accountGasLimits) || !isBytes32(input.gasFees) || !isAddress(input.paymaster) || !isAddress(input.target) || typeof input.selector !== 'string' || !SELECTOR_PATTERN.test(input.selector)) return failure('MALFORMED_REQUEST')
  const execution = decodeAccountExecutionCall(input.callData)
  if (!execution || input.target.toLowerCase() !== execution.target.toLowerCase() || input.selector.toLowerCase() !== execution.selector.toLowerCase()) return failure('MALFORMED_REQUEST')

  const nonce = parseUnsigned(input.nonce, UINT256_MAX)
  const preVerificationGas = parseUnsigned(input.preVerificationGas, UINT256_MAX)
  const paymasterVerificationGasLimit = parseUnsigned(input.paymasterVerificationGasLimit, UINT128_MAX)
  const paymasterPostOpGasLimit = parseUnsigned(input.paymasterPostOpGasLimit, UINT128_MAX)
  if (nonce === undefined || preVerificationGas === undefined || paymasterVerificationGasLimit === undefined || paymasterPostOpGasLimit === undefined) return failure('MALFORMED_REQUEST')

  const packedAccountGasLimits = BigInt(input.accountGasLimits)
  const accountVerificationGasLimit = packedAccountGasLimits >> 128n
  const accountCallGasLimit = packedAccountGasLimits & UINT128_MAX
  const packedGasFees = BigInt(input.gasFees)
  const maxPriorityFeePerGas = packedGasFees >> 128n
  const maxFeePerGas = packedGasFees & UINT128_MAX
  if (maxFeePerGas < maxPriorityFeePerGas) return failure('MALFORMED_REQUEST')
  if (accountVerificationGasLimit > MAX_ACCOUNT_VERIFICATION_GAS_LIMIT || accountCallGasLimit > MAX_ACCOUNT_CALL_GAS_LIMIT || preVerificationGas > MAX_PRE_VERIFICATION_GAS || maxPriorityFeePerGas > MAX_MAX_PRIORITY_FEE_PER_GAS || maxFeePerGas > MAX_MAX_FEE_PER_GAS || paymasterVerificationGasLimit > MAX_PAYMASTER_VERIFICATION_GAS_LIMIT || paymasterPostOpGasLimit > MAX_PAYMASTER_POST_OP_GAS_LIMIT) return failure('COST_LIMIT_EXCEEDED')

  return { ok: true, value: { chainId: MONAD_TESTNET_CHAIN_ID, sender: input.sender, nonce, initCode: input.initCode, callData: input.callData, accountGasLimits: input.accountGasLimits, preVerificationGas, gasFees: input.gasFees, paymaster: input.paymaster, paymasterVerificationGasLimit, paymasterPostOpGasLimit, target: execution.target, selector: execution.selector, executionValue: execution.value, innerCallData: execution.data } }
}
