import { describe, expect, it } from 'vitest'
import { decodeFunctionData } from 'viem'
import { MONAD_ACTIVATION_CONFIG } from '../app/lib/monadConfig'
import { createDepositRequest, entryPointDepositAbi, parseDepositAmount } from '../app/lib/entryPointDeposit'

const SAFE = '0xb127994eed5f0aa8a42a446e796a2fcc0d1bb276'

describe('EntryPoint deposit request', () => {
  it('only constructs a native-MON depositTo request for the fixed EntryPoint and current Safe', () => {
    const request = createDepositRequest({ safe: SAFE, amount: '0.125' })
    const decoded = decodeFunctionData({ abi: entryPointDepositAbi, data: request.data })

    expect(request).toMatchObject({ to: MONAD_ACTIVATION_CONFIG.entryPoint, value: 125000000000000000n })
    expect(decoded.functionName).toBe('depositTo')
    expect(decoded.args?.[0]?.toLowerCase()).toBe(SAFE.toLowerCase())
  })

  it.each(['', '0', '0.0000000000000000001', '-1', 'not-mon'])('rejects invalid or zero native-MON amount %j', (amount) => {
    expect(() => parseDepositAmount(amount)).toThrow(/positive MON amount/)
  })

  it.each(['0x0000000000000000000000000000000000000000', 'not-an-address'])('rejects an invalid beneficiary %s', (safe) => {
    expect(() => createDepositRequest({ safe, amount: '1' })).toThrow(/Safe/)
  })
})
