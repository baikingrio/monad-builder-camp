import { describe, expect, it } from 'vitest'
import {
  MONAD_ENTRY_POINT_V07,
  MONAD_SAFE_4337_MODULE,
  MONAD_SAFE_V141,
  MONAD_SAFE_4337_ZERO_VALUE_LEARNING_CASE,
  getMonadSafe4337LearningCaseStatus,
  getMonadSafe4337Readiness
} from '../app/lib/safe4337MonadConfig'

describe('Monad Safe 4337 configuration', () => {
  it('pins the official Monad Testnet Safe 1.4.1, Safe 4337 Module and EntryPoint v0.7 addresses', () => {
    expect(MONAD_ENTRY_POINT_V07).toBe('0x0000000071727De22E5E9d8BAf0edAc6f37da032')
    expect(MONAD_SAFE_4337_MODULE).toBe('0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226')
    expect(MONAD_SAFE_V141).toBe('0x41675C099F32341bf84BFc5382aF534df5C7461a')
  })

  it('keeps live deployment disabled without a Monad-specific Pimlico key', () => {
    expect(getMonadSafe4337Readiness('')).toEqual({
      ready: false,
      message: '请先设置 NUXT_PUBLIC_MONAD_PIMLICO_API_KEY，才可发送 Monad Safe UserOperation。'
    })
  })

  it('uses the Monad Testnet Pimlico v2 endpoint only with an explicit key', () => {
    const readiness = getMonadSafe4337Readiness('demo-key')
    expect(readiness.ready).toBe(true)
    if (readiness.ready) {
      expect(readiness.bundlerUrl).toContain('/v2/10143/rpc?')
      expect(readiness.bundlerUrl).toContain('demo-key')
      expect(readiness.paymasterUrl).toBe(readiness.bundlerUrl)
    }
  })

  it('provides a zero-value learning-only UserOperation preset with every pre-send check', () => {
    expect(MONAD_SAFE_4337_ZERO_VALUE_LEARNING_CASE).toMatchObject({
      label: '预设零值 UserOperation 学习案例',
      target: '未设置（不使用真实 Safe 地址）',
      value: '0'
    })
    expect(MONAD_SAFE_4337_ZERO_VALUE_LEARNING_CASE.calldata).toMatch(/空 calldata/i)
    expect(MONAD_SAFE_4337_ZERO_VALUE_LEARNING_CASE.preSendChecks).toEqual(expect.arrayContaining([
      expect.stringMatching(/Safe.*存在/i),
      expect.stringMatching(/Owner.*签名/i),
      expect.stringMatching(/Bundler.*模拟/i),
      expect.stringMatching(/Paymaster.*自付 gas/i)
    ]))
  })

  it('marks the learning preset as not ready because it is not signed, simulated, or sent', () => {
    expect(getMonadSafe4337LearningCaseStatus()).toEqual({
      ready: false,
      status: 'learning-only',
      message: '这是预设学习案例：未签名、未模拟、未发送，不可发送。'
    })
  })
})
