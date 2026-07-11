import { describe, expect, expectTypeOf, it } from 'vitest'
import { encodeFunctionData } from 'viem'
import { MAX_ACCOUNT_CALL_GAS_LIMIT, MAX_ACCOUNT_VERIFICATION_GAS_LIMIT, MAX_MAX_FEE_PER_GAS, MAX_MAX_PRIORITY_FEE_PER_GAS, MAX_PAYMASTER_POST_OP_GAS_LIMIT, MAX_PAYMASTER_VERIFICATION_GAS_LIMIT, MAX_PRE_VERIFICATION_GAS, parseSponsorRequest, type SponsorAuthorization, type SponsorRequest } from '../server/utils/sponsor-request'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const PAYMASTER = '0x2222222222222222222222222222222222222222'
const INNER_SELECTOR = '0x12345678'
const EXECUTE_ABI = [{ type: 'function', name: 'execute', inputs: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }], outputs: [{ name: 'result', type: 'bytes' }], stateMutability: 'nonpayable' }] as const
const packed = (high: bigint, low: bigint): `0x${string}` => `0x${high.toString(16).padStart(32, '0')}${low.toString(16).padStart(32, '0')}`
function request(overrides: Partial<SponsorRequest> = {}): SponsorRequest {
  const callData = encodeFunctionData({ abi: EXECUTE_ABI, functionName: 'execute', args: [ADDRESS, 0n, INNER_SELECTOR] })
  return { chainId: 10143, sender: ADDRESS, nonce: '7', initCode: '0x', callData, accountGasLimits: packed(1n, 1n), preVerificationGas: '50000', gasFees: packed(1n, 2n), paymaster: PAYMASTER, paymasterVerificationGasLimit: '100000', paymasterPostOpGasLimit: '50000', target: ADDRESS, selector: INNER_SELECTOR, ...overrides }
}
describe('parseSponsorRequest', () => {
  it('accepts limits exactly at every conservative server cap', () => {
    expect(parseSponsorRequest(request({ accountGasLimits: packed(MAX_ACCOUNT_VERIFICATION_GAS_LIMIT, MAX_ACCOUNT_CALL_GAS_LIMIT), preVerificationGas: MAX_PRE_VERIFICATION_GAS.toString(), gasFees: packed(MAX_MAX_PRIORITY_FEE_PER_GAS, MAX_MAX_FEE_PER_GAS), paymasterVerificationGasLimit: MAX_PAYMASTER_VERIFICATION_GAS_LIMIT.toString(), paymasterPostOpGasLimit: MAX_PAYMASTER_POST_OP_GAS_LIMIT.toString() }))).toMatchObject({ ok: true })
  })
  it.each([
    ['account verification gas', { accountGasLimits: packed(MAX_ACCOUNT_VERIFICATION_GAS_LIMIT + 1n, 1n) }],
    ['account call gas', { accountGasLimits: packed(1n, MAX_ACCOUNT_CALL_GAS_LIMIT + 1n) }],
    ['pre-verification gas', { preVerificationGas: (MAX_PRE_VERIFICATION_GAS + 1n).toString() }],
    ['priority fee', { gasFees: packed(MAX_MAX_PRIORITY_FEE_PER_GAS + 1n, MAX_MAX_PRIORITY_FEE_PER_GAS + 1n) }],
    ['max fee', { gasFees: packed(1n, MAX_MAX_FEE_PER_GAS + 1n) }],
    ['paymaster verification gas', { paymasterVerificationGasLimit: (MAX_PAYMASTER_VERIFICATION_GAS_LIMIT + 1n).toString() }],
    ['paymaster post-op gas', { paymasterPostOpGasLimit: (MAX_PAYMASTER_POST_OP_GAS_LIMIT + 1n).toString() }]
  ])('rejects %s above its cap', (_name, overrides) => expect(parseSponsorRequest(request(overrides))).toEqual({ ok: false, error: { code: 'COST_LIMIT_EXCEEDED' } }))
  it('does not accept or require caller validUntil', () => {
    expect(parseSponsorRequest({ ...request(), validUntil: 9999999999 })).toMatchObject({ ok: true })
    expect(parseSponsorRequest(request())).toMatchObject({ ok: true })
  })
  it('rejects mismatched execution metadata and malformed data', () => {
    expect(parseSponsorRequest(request({ target: PAYMASTER }))).toEqual({ ok: false, error: { code: 'MALFORMED_REQUEST' } })
    expect(parseSponsorRequest(request({ callData: '0x' }))).toEqual({ ok: false, error: { code: 'MALFORMED_REQUEST' } })
  })
})
describe('SponsorAuthorization', () => it('exposes only public response fields', () => expectTypeOf<SponsorAuthorization>().toEqualTypeOf<{ authorization: `0x${string}`, validUntil: number, chainId: 10143, paymaster: `0x${string}` }>()))
