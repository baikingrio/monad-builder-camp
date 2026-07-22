export type DemoStatus =
  | 'disconnected'
  | 'walletConnected'
  | 'authenticated'
  | 'safeDerived'
  | 'activationReady'
  | 'activationPending'
  | 'active'
  | 'failed'

export interface DemoState {
  readonly status: DemoStatus
  readonly walletConnected: boolean
  readonly authenticated: boolean
  readonly onMonadTestnet: boolean
  /** Set only after a future verified Safe SDK/factory derivation. */
  readonly safeDerivationVerified: boolean
  /** True only after the activation UserOperation has been confirmed. */
  readonly safeDeployed: boolean
  readonly sponsorReady: boolean
  readonly error?: string
}

export type DemoEvent =
  | { type: 'walletConnected' }
  | { type: 'walletDisconnected' }
  | { type: 'authenticated' }
  | { type: 'authenticationCleared' }
  | { type: 'monadTestnetChanged'; ready: boolean }
  | { type: 'safeDerivationVerified' }
  | { type: 'sponsorReadinessChanged'; ready: boolean }
  | { type: 'activationStarted' }
  | { type: 'activationSucceeded' }
  | { type: 'activationFailed'; error: string }

export function createDemoState(): DemoState {
  return {
    status: 'disconnected',
    walletConnected: false,
    authenticated: false,
    onMonadTestnet: false,
    safeDerivationVerified: false,
    safeDeployed: false,
    sponsorReady: false
  }
}

function allActivationPrerequisites(state: Omit<DemoState, 'status' | 'error'>): boolean {
  return state.walletConnected
    && state.authenticated
    && state.onMonadTestnet
    && state.safeDerivationVerified
    && state.sponsorReady
}

function statusFor(state: Omit<DemoState, 'status' | 'error'>): DemoStatus {
  if (!state.walletConnected) return 'disconnected'
  if (!state.authenticated) return 'walletConnected'
  if (!state.onMonadTestnet || !state.safeDerivationVerified) return 'authenticated'
  if (state.safeDeployed) return 'active'
  if (!state.sponsorReady) return 'safeDerived'
  return 'activationReady'
}

function normalise(state: Omit<DemoState, 'status' | 'error'>): DemoState {
  return { ...state, status: statusFor(state) }
}

/** The sponsored activation control is enabled only while its prerequisites hold. */
export function isDrawAvailable(state: DemoState): boolean {
  return state.status === 'activationReady' && allActivationPrerequisites(state)
}

/**
 * Pure UI reducer. It models readiness only; it connects no wallet, contacts no
 * sponsor, and makes no Safe-address or deployment claim by itself.
 */
export function transitionDemoState(state: DemoState, event: DemoEvent): DemoState {
  if (event.type === 'walletDisconnected') return createDemoState()
  if (event.type === 'activationFailed') {
    return { ...state, status: 'failed', error: event.error || 'Activation failed' }
  }
  if (state.status === 'failed') {
    throw new Error('clear or disconnect a failed demo state before continuing')
  }

  switch (event.type) {
    case 'walletConnected':
      return normalise({ ...state, walletConnected: true })
    case 'authenticated':
      if (!state.walletConnected) throw new Error('wallet connection is required before authentication')
      return normalise({ ...state, authenticated: true })
    case 'authenticationCleared':
      return normalise({ ...state, authenticated: false, sponsorReady: false })
    case 'monadTestnetChanged':
      return normalise({ ...state, onMonadTestnet: event.ready })
    case 'safeDerivationVerified':
      if (!state.walletConnected || !state.authenticated) {
        throw new Error('wallet connection and authentication are required before Safe derivation')
      }
      return normalise({ ...state, safeDerivationVerified: true })
    case 'sponsorReadinessChanged':
      return normalise({ ...state, sponsorReady: event.ready })
    case 'activationStarted':
      if (!isDrawAvailable(state)) throw new Error('activation prerequisites are not ready')
      return { ...state, status: 'activationPending' }
    case 'activationSucceeded':
      if (state.status !== 'activationPending') throw new Error('activation is not pending')
      return normalise({ ...state, safeDeployed: true })
  }
}
