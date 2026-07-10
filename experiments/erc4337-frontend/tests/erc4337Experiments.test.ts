import { describe, expect, it } from 'vitest'
import { ENTRY_POINT_V08, experiments, getExperimentById, monadTestnet } from '../src/lib/erc4337Experiments'

describe('ERC-4337 experiment catalogue', () => {
  it('keeps the Monad Testnet EntryPoint v0.8 and chain metadata available to the UI', () => {
    expect(monadTestnet.id).toBe(10143)
    expect(monadTestnet.nativeCurrency.symbol).toBe('MON')
    expect(ENTRY_POINT_V08).toBe('0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108')
  })

  it('summarizes the three completed AA experiments in learning order', () => {
    expect(experiments.map((item) => item.id)).toEqual(['counterfactual-initcode', 'sponsored-paymaster', 'session-key'])
    expect(experiments.every((item) => item.status === '已完成链上实验')).toBe(true)
  })

  it('exposes the exact public proof transaction hashes from the daily note', () => {
    expect(getExperimentById('counterfactual-initcode')?.proofs).toContain('handleOps tx: 0x07e26e0a94d9a48f7233e67d07fcd8f1f5f2b18edeadfd2fdd9bbf91bbebf380')
    expect(getExperimentById('sponsored-paymaster')?.proofs).toContain('handleOps tx: 0x44b2c02374367f43ab006be28b524ba32c3a75d9b65b4c34ea3811eeaef86b4d')
    expect(getExperimentById('session-key')?.proofs).toContain('handleOps tx: 0x1b40ca3f39e74b859d917bd927d3efee7c12484a54ce5610c6a9ec41d9bc224d')
  })
})
