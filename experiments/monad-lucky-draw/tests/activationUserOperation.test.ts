import { describe, expect, it } from 'vitest'
import {
  assertActivationDrawRequest,
  encodeLuckyDrawCallData,
  serializeUserOperationForClient,
  LUCKY_DRAW_DRAW_SELECTOR
} from '../app/lib/activationUserOperation'
import { MONAD_ACTIVATION_CONFIG } from '../app/lib/monadConfig'
import { deriveMonadCounterfactualSafe } from '../app/lib/safeAddress'

const OWNER = '0x1111111111111111111111111111111111111111'
const safe = deriveMonadCounterfactualSafe({ owner: OWNER, config: MONAD_ACTIVATION_CONFIG })

describe('activation UserOperation policy', () => {
  it('allows only the fixed LuckyDraw draw call for a verified counterfactual Safe', () => {
    const prepared = assertActivationDrawRequest({
      owner: OWNER,
      safe: { address: safe.address, owner: OWNER, derivationVerified: true, deploymentStatus: 'not-deployed', safeDeployed: false },
      userClicked: true
    })
    expect(prepared.call).toMatchObject({ to: MONAD_ACTIVATION_CONFIG.luckyDraw, value: 0n, data: LUCKY_DRAW_DRAW_SELECTOR })
    expect(prepared.needsDeployment).toBe(true)
    expect(encodeLuckyDrawCallData()).toBe(LUCKY_DRAW_DRAW_SELECTOR)
  })

  it.each([
    ['missing click', { userClicked: false }],
    ['wrong safe', { safe: { address: OWNER, owner: OWNER, derivationVerified: true as const, deploymentStatus: 'not-deployed' as const, safeDeployed: false } }],
    ['owner mismatch', { safe: { address: safe.address, owner: '0x2222222222222222222222222222222222222222', derivationVerified: true as const, deploymentStatus: 'not-deployed' as const, safeDeployed: false } }]
  ])('rejects %s', (_name, override) => {
    expect(() => assertActivationDrawRequest({
      owner: OWNER,
      safe: { address: safe.address, owner: OWNER, derivationVerified: true, deploymentStatus: 'not-deployed', safeDeployed: false },
      userClicked: true,
      ...override
    })).toThrow()
  })

  it('serializes an unsigned sponsored UserOperation without credentials', () => {
    const serialized = serializeUserOperationForClient({
      sender: safe.address,
      nonce: '0x0',
      factory: MONAD_ACTIVATION_CONFIG.safeFactory,
      factoryData: '0xabcd',
      callData: LUCKY_DRAW_DRAW_SELECTOR,
      callGasLimit: '0x1',
      verificationGasLimit: '0x1',
      preVerificationGas: '0x1',
      maxFeePerGas: '0x1',
      maxPriorityFeePerGas: '0x1',
      paymaster: '0x3333333333333333333333333333333333333333',
      paymasterVerificationGasLimit: '0x1',
      paymasterPostOpGasLimit: '0x1',
      paymasterData: '0x',
      signature: '0x'
    })
    expect(serialized.signature).toBe('0x')
    expect(JSON.stringify(serialized)).not.toMatch(/pimlico|apikey|private|secret/i)
  })
})
