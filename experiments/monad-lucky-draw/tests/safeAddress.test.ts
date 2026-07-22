import { describe, expect, it } from 'vitest'
import { MONAD_ACTIVATION_CONFIG } from '../app/lib/monadConfig'
import { deriveMonadCounterfactualSafe, deriveSafeCreate2Address } from '../app/lib/safeAddress'

const OWNER = '0x1111111111111111111111111111111111111111'

describe('Monad counterfactual Safe derivation', () => {
  it('derives a deterministic Safe 1.4.1 proxy address for one authenticated EOA owner', () => {
    const first = deriveMonadCounterfactualSafe({ owner: OWNER, config: MONAD_ACTIVATION_CONFIG, saltNonce: 0n })
    const repeated = deriveMonadCounterfactualSafe({ owner: OWNER, config: MONAD_ACTIVATION_CONFIG, saltNonce: 0n })

    expect(first.address).toBe('0x7B230f5FcE1f5A2912759C6339C9Dc5fdb3f427C')
    expect(repeated).toEqual(first)
    expect(first.owner).toBe(OWNER)
    expect(first.threshold).toBe(1)
    expect(first.deployment).toBe('counterfactual-not-deployed')
  })

  it('uses the SafeProxyFactory CREATE2 salt: keccak256(keccak256(initializer) ++ uint256(nonce))', () => {
    const derived = deriveMonadCounterfactualSafe({ owner: OWNER, config: MONAD_ACTIVATION_CONFIG, saltNonce: 7n })
    expect(deriveSafeCreate2Address({
      factory: MONAD_ACTIVATION_CONFIG.safeFactory,
      proxyCreationCode: MONAD_ACTIVATION_CONFIG.safeProxyCreationCode,
      singleton: MONAD_ACTIVATION_CONFIG.safeSingleton,
      initializer: derived.initializer,
      saltNonce: 7n
    })).toBe(derived.address)
  })

  it('changes the address when the owner or nonce changes', () => {
    const baseline = deriveMonadCounterfactualSafe({ owner: OWNER, config: MONAD_ACTIVATION_CONFIG, saltNonce: 0n })
    expect(deriveMonadCounterfactualSafe({ owner: '0x2222222222222222222222222222222222222222', config: MONAD_ACTIVATION_CONFIG, saltNonce: 0n }).address).not.toBe(baseline.address)
    expect(deriveMonadCounterfactualSafe({ owner: OWNER, config: MONAD_ACTIVATION_CONFIG, saltNonce: 1n }).address).not.toBe(baseline.address)
  })

  it('rejects unverified configuration and invalid owners rather than deriving a claim', () => {
    expect(() => deriveMonadCounterfactualSafe({ owner: '0x0000000000000000000000000000000000000000', config: MONAD_ACTIVATION_CONFIG, saltNonce: 0n })).toThrow(/owner/)
    expect(() => deriveMonadCounterfactualSafe({ owner: OWNER, config: { ...MONAD_ACTIVATION_CONFIG, safeFactory: '0x1111111111111111111111111111111111111111' }, saltNonce: 0n })).toThrow(/verified Monad Testnet configuration/)
  })
})
