import { describe, expect, it } from 'vitest'
import { assertStoredSessionDrawOperation, appendSessionSignature, assertSessionDrawSubmitBody } from '../server/utils/sessionExecution'

const SAFE = '0x2222222222222222222222222222222222222222'
const EOA = '0x1111111111111111111111111111111111111111'
const SIGNATURE = `0x${'11'.repeat(65)}`
const operation = { sender: SAFE, nonce: '0x1', callData: '0xdeadbeef', callGasLimit: '0x5208', verificationGasLimit: '0x10000', preVerificationGas: '0xc350', maxFeePerGas: '0x3b9aca00', maxPriorityFeePerGas: '0x1', signature: '0x' }

describe('server-authoritative user-funded Session Draw preparations', () => {
  it('accepts only an opaque preparation ID and signature, rejecting arbitrary/mutated client operations and paymaster injection', () => {
    expect(() => assertSessionDrawSubmitBody({ preparationId: 'prepared', signature: SIGNATURE, userOperation: operation })).toThrow(/caller-supplied/i)
    expect(() => assertSessionDrawSubmitBody({ preparationId: 'prepared', signature: SIGNATURE, paymaster: EOA })).toThrow(/caller-supplied/i)
    expect(assertSessionDrawSubmitBody({ preparationId: 'prepared', signature: SIGNATURE })).toEqual({ preparationId: 'prepared', signature: SIGNATURE })
  })

  it('rejects paymaster/factory/mutated stored fields and wrong Safe or stale insufficient deposit before send', () => {
    expect(() => assertStoredSessionDrawOperation({ userOperation: { ...operation, paymaster: EOA }, safe: SAFE, expectedCallData: operation.callData })).toThrow(/paymaster/i)
    expect(() => assertStoredSessionDrawOperation({ userOperation: { ...operation, factory: EOA }, safe: SAFE, expectedCallData: operation.callData })).toThrow(/factory/i)
    expect(() => assertStoredSessionDrawOperation({ userOperation: { ...operation, callData: '0x00' }, safe: SAFE, expectedCallData: operation.callData })).toThrow(/callData/i)
    expect(() => assertStoredSessionDrawOperation({ userOperation: operation, safe: EOA, expectedCallData: operation.callData })).toThrow(/sender/i)
    expect(() => assertStoredSessionDrawOperation({ userOperation: operation, safe: SAFE, expectedCallData: operation.callData, deposit: 0n })).toThrow(/insufficient EntryPoint deposit/i)
  })

  it('only appends the signature to the claimed operation, so a consumed preparation cannot be reconstructed with mutation', () => {
    expect(appendSessionSignature({ userOperation: operation, signature: SIGNATURE })).toEqual({ ...operation, signature: SIGNATURE })
  })
})
