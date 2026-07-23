import { describe, expect, it } from 'vitest'
import { assertSufficientEntryPointDeposit, conservativeUserOperationCost } from '../server/utils/userFundedExecution'

const userOperation = {
  callGasLimit: '0x5208',
  verificationGasLimit: '0x10000',
  preVerificationGas: '0xc350',
  maxFeePerGas: '0x3b9aca00'
}

describe('user-funded Session Draw gas guard', () => {
  it('computes a conservative total cost and rejects an insufficient EntryPoint deposit before signing', () => {
    const required = conservativeUserOperationCost(userOperation)
    expect(required).toBeGreaterThan(0n)
    expect(() => assertSufficientEntryPointDeposit({ deposit: required - 1n, userOperation })).toThrow(/insufficient EntryPoint deposit/i)
    expect(() => assertSufficientEntryPointDeposit({ deposit: required, userOperation })).not.toThrow()
  })

  it('has no Paymaster fields in a user-funded operation shape', () => {
    expect(userOperation).not.toHaveProperty('paymaster')
    expect(userOperation).not.toHaveProperty('paymasterData')
    expect(userOperation).not.toHaveProperty('paymasterVerificationGasLimit')
    expect(userOperation).not.toHaveProperty('paymasterPostOpGasLimit')
  })
})
