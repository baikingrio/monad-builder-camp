import { encodeFunctionData, isAddress, parseUnits, type Address, type Hex } from 'viem'
import { MONAD_ACTIVATION_CONFIG } from './monadConfig'

/** Minimal EntryPoint v0.7 ABI used for user-controlled Safe deposits. */
export const entryPointDepositAbi = [{
  type: 'function',
  name: 'depositTo',
  stateMutability: 'payable',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: []
}, {
  type: 'function',
  name: 'balanceOf',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: 'deposit', type: 'uint256' }]
}] as const

/** Parses a positive native-MON amount without performing wallet or RPC I/O. */
export function parseDepositAmount(amount: string): bigint {
  try {
    if (!/^\d+(?:\.\d+)?$/.test(amount.trim())) throw new Error('invalid')
    const value = parseUnits(amount.trim(), 18)
    if (value <= 0n) throw new Error('invalid')
    return value
  } catch {
    throw new Error('a positive MON amount is required')
  }
}

/** Builds the sole permitted browser wallet transaction: EntryPoint.depositTo(currentSafe). */
export function createDepositRequest(input: { readonly safe: string; readonly amount: string }): {
  readonly to: Address
  readonly data: Hex
  readonly value: bigint
} {
  if (!isAddress(input.safe) || input.safe.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    throw new Error('a valid current Safe beneficiary is required')
  }
  return Object.freeze({
    to: MONAD_ACTIVATION_CONFIG.entryPoint as Address,
    data: encodeFunctionData({
      abi: entryPointDepositAbi,
      functionName: 'depositTo',
      args: [input.safe as Address]
    }),
    value: parseDepositAmount(input.amount)
  })
}
