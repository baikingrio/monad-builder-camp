import { describe, expect, it } from 'vitest'
import { encodeFunctionData } from 'viem'
import { authorizeSponsorRequest, MAX_CHECK_IN_NOTE_BYTES, type SponsorServiceConfig } from '../server/utils/sponsor-service'
import { SPONSOR_AUTHORIZATION_TTL_SECONDS, type SponsorRequest } from '../server/utils/sponsor-request'
const NOW = 1_700_000_000
const SENDER = '0x1111111111111111111111111111111111111111'
const PAYMASTER = '0x2222222222222222222222222222222222222222'
const TARGET = '0x3333333333333333333333333333333333333333'
const PRIVATE_KEY = `0x${'0'.repeat(59)}a11ce`
const CHECK_IN_ABI = [{ type: 'function', name: 'checkIn', inputs: [{ name: 'note', type: 'string' }], outputs: [{ name: 'count', type: 'uint256' }], stateMutability: 'nonpayable' }] as const
const EXECUTE_ABI = [{ type: 'function', name: 'execute', inputs: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }], outputs: [{ name: 'result', type: 'bytes' }], stateMutability: 'nonpayable' }] as const
const config: SponsorServiceConfig = { signingEnabled: true, privateKey: PRIVATE_KEY, paymaster: PAYMASTER, allowedCheckInTarget: TARGET }
function request(note = 'daily-checkin', value = 0n): SponsorRequest {
  const data = encodeFunctionData({ abi: CHECK_IN_ABI, functionName: 'checkIn', args: [note] })
  const callData = encodeFunctionData({ abi: EXECUTE_ABI, functionName: 'execute', args: [TARGET, value, data] })
  return { chainId: 10143, sender: SENDER, nonce: '7', initCode: '0x', callData, accountGasLimits: `0x${'00'.repeat(31)}01`, preVerificationGas: '50000', gasFees: `0x${'00'.repeat(31)}02`, paymaster: PAYMASTER, paymasterVerificationGasLimit: '100000', paymasterPostOpGasLimit: '50000', target: TARGET, selector: data.slice(0, 10) }
}
describe('authorizeSponsorRequest', () => {
  it('is disabled by default through its typed unavailable error', async () => expect(authorizeSponsorRequest(request(), NOW, { ...config, signingEnabled: false })).resolves.toEqual({ ok: false, error: { code: 'SPONSOR_SIGNING_UNAVAILABLE' } }))
  it('derives fixed validUntil server-side and ignores caller validUntil', async () => {
    const result = await authorizeSponsorRequest({ ...request(), validUntil: NOW + 999999 }, NOW, config)
    expect(result).toMatchObject({ ok: true, value: { validUntil: NOW + SPONSOR_AUTHORIZATION_TTL_SECONDS } })
  })
  it.each([
    ['non-zero execute value', request('daily-checkin', 1n)],
    ['empty note', request('')],
    ['oversized note', request('x'.repeat(MAX_CHECK_IN_NOTE_BYTES + 1))]
  ])('rejects %s for the exact checkIn policy', async (_name, candidate) => expect(authorizeSponsorRequest(candidate, NOW, config)).resolves.toEqual({ ok: false, error: { code: 'CALL_NOT_ALLOWED' } }))
  it('signs the one exact zero-value, bounded checkIn call', async () => expect(authorizeSponsorRequest(request(), NOW, config)).resolves.toMatchObject({ ok: true, value: { paymaster: PAYMASTER, validUntil: NOW + SPONSOR_AUTHORIZATION_TTL_SECONDS } }))
})
