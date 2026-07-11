import { concatHex, decodeFunctionData, encodeAbiParameters, encodeFunctionData, isAddress, keccak256, toHex, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { MONAD_TESTNET_CHAIN_ID, parseSponsorRequest, SPONSOR_AUTHORIZATION_TTL_SECONDS, type SponsorAuthorization, type SponsorRequestErrorCode } from './sponsor-request'

const CHECK_IN_SELECTOR = '0xf21bb4c5'
/** Maximum UTF-8 bytes accepted for SessionKeyDemoTarget.checkIn(string). */
export const MAX_CHECK_IN_NOTE_BYTES = 280
const CHECK_IN_ABI = [{ type: 'function', name: 'checkIn', inputs: [{ name: 'note', type: 'string' }], outputs: [{ name: 'count', type: 'uint256' }], stateMutability: 'nonpayable' }] as const

export interface SponsorServiceConfig {
  /** Explicit private switch; this learning signer is disabled unless true. */
  signingEnabled: boolean
  /** Server-only secret. This must never use a NUXT_PUBLIC_ environment name. */
  privateKey: string | undefined
  paymaster: string | undefined
  allowedCheckInTarget: string | undefined
}
export type SponsorServiceErrorCode = SponsorRequestErrorCode | 'CALL_NOT_ALLOWED' | 'SPONSOR_KEY_UNAVAILABLE' | 'SPONSOR_SIGNING_UNAVAILABLE'
export type SponsorServiceResult = | { ok: true, value: SponsorAuthorization } | { ok: false, error: { code: SponsorServiceErrorCode } }
function failure(code: SponsorServiceErrorCode): SponsorServiceResult { return { ok: false, error: { code } } }
function isPrivateKey(value: string | undefined): value is Hex { return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value) }

/** Rejects non-zero ETH, malformed/non-canonical ABI, empty, and overlong notes. */
function isAllowedCheckInCall(value: bigint, data: Hex): boolean {
  if (value !== 0n || data.slice(0, 10).toLowerCase() !== CHECK_IN_SELECTOR) return false
  try {
    const decoded = decodeFunctionData({ abi: CHECK_IN_ABI, data })
    if (decoded.functionName !== 'checkIn') return false
    const [note] = decoded.args
    if (note.length === 0 || new TextEncoder().encode(note).length > MAX_CHECK_IN_NOTE_BYTES) return false
    return encodeFunctionData({ abi: CHECK_IN_ABI, functionName: 'checkIn', args: [note] }).toLowerCase() === data.toLowerCase()
  } catch { return false }
}

function authorizationDigest(request: { sender: Address, nonce: bigint, initCode: Hex, callData: Hex, accountGasLimits: Hex, preVerificationGas: bigint, gasFees: Hex, validUntil: number, paymasterVerificationGasLimit: bigint, paymasterPostOpGasLimit: bigint }, paymaster: Address): Hex {
  return keccak256(encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'uint48' }, { type: 'uint128' }, { type: 'uint128' }, { type: 'uint256' }, { type: 'address' }],
    [request.sender, request.nonce, keccak256(request.initCode), keccak256(request.callData), request.accountGasLimits, request.preVerificationGas, request.gasFees, BigInt(request.validUntil), request.paymasterVerificationGasLimit, request.paymasterPostOpGasLimit, BigInt(MONAD_TESTNET_CHAIN_ID), paymaster]
  ))
}

/** Validates and signs one exact zero-value SessionKeyDemoTarget.checkIn(string) call. */
export async function authorizeSponsorRequest(input: unknown, nowInSeconds: number, config: SponsorServiceConfig): Promise<SponsorServiceResult> {
  if (!Number.isSafeInteger(nowInSeconds) || nowInSeconds < 0) return failure('MALFORMED_REQUEST')
  if (!config.signingEnabled) return failure('SPONSOR_SIGNING_UNAVAILABLE')
  const parsed = parseSponsorRequest(input)
  if (!parsed.ok) return parsed
  if (!isPrivateKey(config.privateKey) || !isAddress(config.paymaster) || !isAddress(config.allowedCheckInTarget)) return failure('SPONSOR_KEY_UNAVAILABLE')

  const request = { ...parsed.value, validUntil: nowInSeconds + SPONSOR_AUTHORIZATION_TTL_SECONDS }
  if (request.paymaster.toLowerCase() !== config.paymaster.toLowerCase() || request.target.toLowerCase() !== config.allowedCheckInTarget.toLowerCase() || request.selector.toLowerCase() !== CHECK_IN_SELECTOR || !isAllowedCheckInCall(request.executionValue, request.innerCallData)) return failure('CALL_NOT_ALLOWED')

  let signature: Hex
  try { signature = await privateKeyToAccount(config.privateKey).sign({ hash: authorizationDigest(request, config.paymaster) }) } catch { return failure('SPONSOR_KEY_UNAVAILABLE') }
  const authorization = concatHex([config.paymaster, toHex(request.paymasterVerificationGasLimit, { size: 16 }), toHex(request.paymasterPostOpGasLimit, { size: 16 }), toHex(BigInt(request.validUntil), { size: 6 }), signature])
  return { ok: true, value: { authorization, validUntil: request.validUntil, chainId: MONAD_TESTNET_CHAIN_ID, paymaster: config.paymaster } }
}
