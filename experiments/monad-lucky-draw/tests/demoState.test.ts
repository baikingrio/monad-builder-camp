import { describe, expect, it } from 'vitest'
import {
  createDemoState,
  isDrawAvailable,
  transitionDemoState
} from '../app/lib/demoState'

const firstEoa = '0x1111111111111111111111111111111111111111'
const secondEoa = '0x2222222222222222222222222222222222222222'

function activationReadyState() {
  let state = createDemoState()
  state = transitionDemoState(state, { type: 'walletConnected', eoa: firstEoa })
  state = transitionDemoState(state, { type: 'authenticated' })
  state = transitionDemoState(state, { type: 'monadTestnetChanged', ready: true })
  state = transitionDemoState(state, { type: 'safeDerivationVerified', address: '0x3333333333333333333333333333333333333333' })
  return transitionDemoState(state, { type: 'sponsorReadinessChanged', ready: true })
}

describe('lucky draw demo state machine', () => {
  it('shows generated-but-not-deployed Safe separately from active Safe', () => {
    let state = createDemoState()
    state = transitionDemoState(state, { type: 'walletConnected', eoa: firstEoa })
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

    state = transitionDemoState(state, { type: 'walletConnected', eoa: firstEoa })
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
    const state = activationReadyState()

    expect(state.status).toBe('activationReady')
    expect(isDrawAvailable(state)).toBe(true)

    const pending = transitionDemoState(state, { type: 'activationStarted' })
    expect(pending.status).toBe('activationPending')
    expect(isDrawAvailable(pending)).toBe(false)
  })

  it('locks the activation state while pending except for terminal or recovery events', () => {
    const pending = transitionDemoState(activationReadyState(), { type: 'activationStarted' })

    expect(transitionDemoState(pending, { type: 'walletConnected', eoa: secondEoa })).toBe(pending)
    expect(transitionDemoState(pending, { type: 'authenticated' })).toBe(pending)
    expect(transitionDemoState(pending, { type: 'safeDerivationVerified' })).toBe(pending)
    expect(() => transitionDemoState(pending, { type: 'activationStarted' })).toThrow(/pending/)
    expect(transitionDemoState(pending, { type: 'walletDisconnected' }).status).toBe('disconnected')
  })

  it('only records activation failure while activation is pending', () => {
    const disconnected = createDemoState()
    expect(() => transitionDemoState(disconnected, { type: 'activationFailed', error: 'late failure' })).toThrow(/pending/)

    const active = transitionDemoState(
      transitionDemoState(activationReadyState(), { type: 'activationStarted' }),
      { type: 'activationSucceeded' }
    )
    expect(() => transitionDemoState(active, { type: 'activationFailed', error: 'late failure' })).toThrow(/pending/)

    const failed = transitionDemoState(
      transitionDemoState(activationReadyState(), { type: 'activationStarted' }),
      { type: 'activationFailed', error: 'Sponsor rejected request' }
    )
    expect(failed.status).toBe('failed')
    expect(failed.error).toBe('Sponsor rejected request')
  })

  it('invalidates account-bound Safe and sponsor readiness when authentication or EOA changes', () => {
    const ready = activationReadyState()
    const cleared = transitionDemoState(ready, { type: 'authenticationCleared' })

    expect(cleared.authenticated).toBe(false)
    expect(cleared.safeDerivationVerified).toBe(false)
    expect(cleared.sponsorReady).toBe(false)
    expect(cleared.status).toBe('walletConnected')

    const changedAccount = transitionDemoState(ready, { type: 'walletConnected', eoa: secondEoa })
    expect(changedAccount.connectedEoa).toBe(secondEoa)
    expect(changedAccount.authenticated).toBe(false)
    expect(changedAccount.safeDerivationVerified).toBe(false)
    expect(changedAccount.sponsorReady).toBe(false)
    expect(changedAccount.safeDeployed).toBe(false)
    expect(changedAccount.status).toBe('walletConnected')
  })
})
