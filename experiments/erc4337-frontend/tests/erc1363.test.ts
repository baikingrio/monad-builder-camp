import { describe, expect, it } from 'vitest'
import {
  getErc1363Deployment,
  parseTokenAmount,
  validateErc1363Deployment
} from '../app/lib/erc1363'

describe('ERC-1363 staking helpers', () => {
  it('treats missing or malformed contract addresses as unconfigured', () => {
    expect(validateErc1363Deployment({ tokenAddress: '', vaultAddress: '' })).toBe(false)
    expect(validateErc1363Deployment({
      tokenAddress: 'not-an-address',
      vaultAddress: '0x0000000000000000000000000000000000000001'
    })).toBe(false)
    expect(getErc1363Deployment({ tokenAddress: '', vaultAddress: '' })).toBeNull()
  })

  it('accepts valid deployed addresses and parses only positive token amounts', () => {
    const deployment = getErc1363Deployment({
      tokenAddress: '0x0000000000000000000000000000000000000001',
      vaultAddress: '0x0000000000000000000000000000000000000002'
    })

    expect(deployment).toEqual({
      tokenAddress: '0x0000000000000000000000000000000000000001',
      vaultAddress: '0x0000000000000000000000000000000000000002'
    })
    expect(parseTokenAmount('1.25', 18)).toBe(1250000000000000000n)
    expect(() => parseTokenAmount('0', 18)).toThrow(/大于 0/)
    expect(() => parseTokenAmount('-1', 18)).toThrow(/有效/)
    expect(() => parseTokenAmount('1.0000000000000000001', 18)).toThrow(/小数位/)
  })
})
