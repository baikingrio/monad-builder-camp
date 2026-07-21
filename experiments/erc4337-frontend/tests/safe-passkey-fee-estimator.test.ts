import { describe, expect, it } from 'vitest'
import {
  SAFE_PASSKEY_MIN_PRE_VERIFICATION_GAS,
  SAFE_PASSKEY_PRE_VERIFICATION_GAS_MULTIPLIER,
  safePasskeyFeeEstimator
} from '../app/lib/safePasskeyFeeEstimator'

describe('safePasskeyFeeEstimator', () => {
  it('raises preVerificationGas to at least the Passkey deploy floor', async () => {
    const userOperation = {
      sender: '0x',
      nonce: 0n,
      initCode: '0x',
      callData: '0x',
      callGasLimit: 100_000n,
      verificationGasLimit: 200_000n,
      preVerificationGas: 2_555_503n,
      maxFeePerGas: 1n,
      maxPriorityFeePerGas: 1n,
      paymasterAndData: '0x',
      signature: '0x'
    }
    const adjusted = await safePasskeyFeeEstimator.adjustEstimation!({
      userOperation,
      bundlerUrl: 'https://example.invalid',
      entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
    })
    expect(adjusted?.preVerificationGas).toBeGreaterThanOrEqual(SAFE_PASSKEY_MIN_PRE_VERIFICATION_GAS)
    expect(adjusted?.preVerificationGas).toBeGreaterThanOrEqual(8_468_675n)
  })
})
