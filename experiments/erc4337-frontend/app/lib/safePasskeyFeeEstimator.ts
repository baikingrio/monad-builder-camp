import { PimlicoFeeEstimator, type IFeeEstimator } from '@safe-global/relay-kit'

/**
 * Passkey UserOp 在签名后 calldata 远大于 dummy；Pimlico 默认 adjust +5% preVerificationGas 常不够。
 * 参考 bundler 报错 required ~8.4M vs got ~2.5M，留 ≥9M 下限。
 */
export const SAFE_PASSKEY_MIN_PRE_VERIFICATION_GAS = 9_000_000n
export const SAFE_PASSKEY_PRE_VERIFICATION_GAS_MULTIPLIER = 4n

const pimlicoBase = new PimlicoFeeEstimator()

export const safePasskeyFeeEstimator: IFeeEstimator = {
  setupEstimation: (props) => pimlicoBase.setupEstimation!(props),
  adjustEstimation: async (props) => {
    const base = await pimlicoBase.adjustEstimation!(props)
    const scaled = props.userOperation.preVerificationGas * SAFE_PASSKEY_PRE_VERIFICATION_GAS_MULTIPLIER
    const preVerificationGas =
      scaled > SAFE_PASSKEY_MIN_PRE_VERIFICATION_GAS ? scaled : SAFE_PASSKEY_MIN_PRE_VERIFICATION_GAS
    return {
      callGasLimit: base.callGasLimit,
      verificationGasLimit: base.verificationGasLimit,
      preVerificationGas
    }
  },
  getPaymasterEstimation: (props) => pimlicoBase.getPaymasterEstimation!(props)
}
