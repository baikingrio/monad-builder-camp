import { describe, expect, it } from 'vitest'
import { createSafeNativeFundRequest } from '../app/lib/safeNativeFund'

const SAFE = '0xb127994eed5f0aa8a42a446e796a2fcc0d1bb276'

describe('Safe native fund request', () => {
  it('constructs a plain native transfer to the current Safe only', () => {
    const request = createSafeNativeFundRequest({ safe: SAFE, amount: '0.1' })
    expect(request).toEqual({
      to: SAFE,
      data: '0x',
      value: 100000000000000000n
    })
  })

  it.each(['0x0000000000000000000000000000000000000000', 'not-an-address'])('rejects an invalid Safe %s', (safe) => {
    expect(() => createSafeNativeFundRequest({ safe, amount: '0.1' })).toThrow(/Safe/)
  })

  it('rejects zero or invalid amounts', () => {
    expect(() => createSafeNativeFundRequest({ safe: SAFE, amount: '0' })).toThrow(/positive MON amount/)
  })
})
