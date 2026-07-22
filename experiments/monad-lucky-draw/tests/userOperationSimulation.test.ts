// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { MONAD_ACTIVATION_CONFIG } from '../app/lib/monadConfig'
import { deriveMonadCounterfactualSafe } from '../app/lib/safeAddress'
import { createFixedV07SimulationPreparation, LUCKY_DRAW_DRAW_SELECTOR, type SimulationPreparationInput } from '../app/lib/userOperationSimulation'
import { createDevelopmentStore } from '../server/utils/store'
import { evaluateFixedSimulationReadiness } from '../server/utils/simulationReadiness'

const OWNER = '0x1111111111111111111111111111111111111111'
const NOW = Date.parse('2026-07-22T12:00:00.000Z')
const safe = deriveMonadCounterfactualSafe({ owner: OWNER, config: MONAD_ACTIVATION_CONFIG })

function input(overrides: Partial<SimulationPreparationInput> = {}): SimulationPreparationInput {
  return {
    config: MONAD_ACTIVATION_CONFIG,
    ownerAuthorization: { owner: OWNER, cryptographicallyVerified: true },
    safe: { address: safe.address, owner: OWNER, derivationVerified: true, deploymentStatus: 'not-deployed', safeDeployed: false },
    userClicked: true,
    ...overrides
  }
}

describe('fixed v0.7 activation/draw simulation preparation', () => {
  it('prepares exactly the unsigned fixed v0.7 request with no paymaster or execution capability', () => {
    const prepared = createFixedV07SimulationPreparation(input())
    expect(prepared).toMatchObject({ kind: 'fixed-v07-activation-draw-simulation-preparation', chainId: 10143, owner: OWNER, safe: safe.address, target: MONAD_ACTIVATION_CONFIG.luckyDraw, value: 0n, drawSelector: LUCKY_DRAW_DRAW_SELECTOR })
    expect(prepared.simulation).toMatchObject({ entryPoint: MONAD_ACTIVATION_CONFIG.entryPoint, userOperation: { sender: safe.address, factory: MONAD_ACTIVATION_CONFIG.safeFactory, callData: LUCKY_DRAW_DRAW_SELECTOR, signature: '0x', paymaster: null, paymasterData: null } })
    expect(prepared.simulation.userOperation.factoryData).toMatch(/^0x[0-9a-f]+$/i)
    expect(JSON.stringify(prepared, (_, value) => typeof value === 'bigint' ? value.toString() : value)).not.toMatch(/pimlico|sponsor|bundler|privateKey/i)
  })

  it.each([
    ['arbitrary calldata', {}, { callData: '0xdeadbeef' }],
    ['nonzero value', {}, { value: 1n }],
    ['changed target', {}, { target: OWNER }],
    ['changed EntryPoint', {}, { entryPoint: OWNER }],
    ['changed factory', {}, { factory: OWNER }],
    ['changed sender', {}, { sender: OWNER }],
    ['missing authentication', { ownerAuthorization: undefined }, {}],
    ['unverified authentication', { ownerAuthorization: { owner: OWNER, cryptographicallyVerified: false } }, {}],
    ['missing Safe', { safe: undefined }, {}],
    ['deployed Safe contradiction', { safe: { address: safe.address, owner: OWNER, derivationVerified: true, deploymentStatus: 'not-deployed', safeDeployed: true } as never }, {}],
    ['not-deployed status contradiction', { safe: { address: safe.address, owner: OWNER, derivationVerified: true, deploymentStatus: 'deployed', safeDeployed: false } as never }, {}],
    ['changed Safe address', { safe: { address: OWNER, owner: OWNER, derivationVerified: true, deploymentStatus: 'not-deployed', safeDeployed: false } }, {}],
    ['missing explicit click', { userClicked: false }, {}]
  ])('rejects independent tampering: %s', (_name, changedInput, overrides) => {
    expect(() => createFixedV07SimulationPreparation(input(changedInput), overrides)).toThrow()
  })
})

describe('server simulation readiness is permanently non-executing', () => {
  it('requires a verified session and explicit click, then returns blockers and metadata only', () => {
    const store = createDevelopmentStore()
    store.saveSession({ id: 'verified-session', eoa: OWNER, expiresAt: NOW + 60_000, used: false })
    const noClick = evaluateFixedSimulationReadiness(store, { sessionId: 'verified-session', safe: input().safe, userClicked: false }, NOW)
    expect(noClick).toMatchObject({ enabled: false, contactedBundler: false, sponsorUsed: false })
    expect(noClick.blockers).toContain('an explicit user simulation-preview click is required')

    const response = evaluateFixedSimulationReadiness(store, { sessionId: 'verified-session', safe: input().safe, userClicked: true }, NOW)
    expect(response).toMatchObject({ enabled: false, contactedBundler: false, sponsorUsed: false, metadata: { mode: 'preparation-only', target: MONAD_ACTIVATION_CONFIG.luckyDraw, value: '0' } })
    expect(response.blockers).toEqual([])
  })

  it('does not call a Bundler or Sponsor and does not leak supplied secrets on rejection', () => {
    const store = createDevelopmentStore()
    const bundler = vi.fn()
    const sponsor = vi.fn()
    const secret = 'test-only-secret-must-not-leak'
    const response = evaluateFixedSimulationReadiness(store, { sessionId: secret, userClicked: true, overrides: { callData: secret } }, NOW)
    expect(bundler).not.toHaveBeenCalled()
    expect(sponsor).not.toHaveBeenCalled()
    expect(JSON.stringify(response)).not.toContain(secret)
    expect(response).toMatchObject({ enabled: false, contactedBundler: false, sponsorUsed: false })
  })
})
