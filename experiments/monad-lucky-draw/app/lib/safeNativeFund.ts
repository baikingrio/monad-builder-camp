import { isAddress, type Address, type Hex } from 'viem'
import { parseDepositAmount } from './entryPointDeposit'

/** Builds a wallet tx that sends native MON directly to the current Safe (for Roles tip). */
export function createSafeNativeFundRequest(input: { readonly safe: string; readonly amount: string }): {
  readonly to: Address
  readonly data: Hex
  readonly value: bigint
} {
  if (!isAddress(input.safe) || input.safe.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    throw new Error('a valid current Safe beneficiary is required')
  }
  return Object.freeze({
    to: input.safe as Address,
    data: '0x' as Hex,
    value: parseDepositAmount(input.amount)
  })
}
