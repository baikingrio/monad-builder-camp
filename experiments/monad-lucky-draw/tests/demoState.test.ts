import { describe, expect, it } from 'vitest'
import {
  createDemoState,
  isDrawAvailable,
  transitionDemoState
} from '../app/lib/demoState'

describe('lucky draw demo state machine', () => {
  it('shows generated-but-not-deployed Safe separately from active Safe', () => {
    let state = createDemoState()
    state = transitionDemoState(state, { type: 'walletConnected' })
    state = transitionDemoState(state, { type: 'authenticated' })
    state = transitionDemoState(state, { type: 'monadTestnetChanged', ready: true })
    state = transitionDemoState(state, { type: 'safeDerivationVerified' })

    expect(state.status).toBe('safeDerived')
    expect(state.safeDerivationVerified).toBe(true)
    expect(state.safeDeployed).toBe(false)
    expect(isDrawAvailable(state)).toBe(false)

    state = transitionDemoState(state, { type: 'sponsorReadinessChanged', ready: true })
    state = transitionDemoState(state, { type: 'activationStarted' })
    state = transitionDemoState(state, { type: 'activationSucceeded' })

    expect(state.status).toBe('active')
    expect(state.safeDeployed).toBe(true)
  })

  it('does not expose draw action before wallet, login and chain readiness', () => {
    let state = createDemoState()
    expect(state.status).toBe('disconnected')
    expect(isDrawAvailable(state)).toBe(false)

    state = transitionDemoState(state, { type: 'walletConnected' })
    expect(state.status).toBe('walletConnected')
    expect(isDrawAvailable(state)).toBe(false)

    state = transitionDemoState(state, { type: 'authenticated' })
    expect(state.status).toBe('authenticated')
    expect(isDrawAvailable(state)).toBe(false)

    state = transitionDemoState(state, { type: 'safeDerivationVerified' })
    expect(state.status).toBe('authenticated')
    expect(isDrawAvailable(state)).toBe(false)

    state = transitionDemoState(state, { type: 'monadTestnetChanged', ready: true })
    expect(state.status).toBe('safeDerived')
    expect(isDrawAvailable(state)).toBe(false)
  })

  it('only makes drawing available when all verified prerequisites are ready', () => {
    let state = createDemoState()
    state = transitionDemoState(state, { type: 'walletConnected' })
    state = transitionDemoState(state, { type: 'authenticated' })
    state = transitionDemoState(state, { type: 'monadTestnetChanged', ready: true })
    state = transitionDemoState(state, { type: 'safeDerivationVerified' })
    state = transitionDemoState(state, { type: 'sponsorReadinessChanged', ready: true })

    expect(state.status).toBe('activationReady')
    expect(isDrawAvailable(state)).toBe(true)

    state = transitionDemoState(state, { type: 'activationStarted' })
    expect(state.status).toBe('activationPending')
    expect(isDrawAvailable(state)).toBe(false)
  })

  it('models failure and prevents activation from invalid states', () => {
    let state = createDemoState()

    expect(() => transitionDemoState(state, { type: 'activationStarted' })).toThrow()
    state = transitionDemoState(state, { type: 'activationFailed', error: 'Sponsor rejected request' })
    expect(state.status).toBe('failed')
    expect(state.error).toBe('Sponsor rejected request')
    expect(isDrawAvailable(state)).toBe(false)
  })
})
