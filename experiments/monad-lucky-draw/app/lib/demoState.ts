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
  /** The connected EOA; all authentication and Safe readiness is bound to it. */
  readonly connectedEoa?: string
  readonly authenticated: boolean
  readonly onMonadTestnet: boolean
  /** Set only after the authenticated owner is derived with the pinned Safe factory configuration. */
  readonly safeDerivationVerified: boolean
  /** Purely derived from the authenticated owner and pinned Safe factory config. */
  readonly counterfactualSafeAddress?: string
  /** True only after the activation UserOperation has been confirmed. */
  readonly safeDeployed: boolean
  readonly sponsorReady: boolean
  readonly error?: string
}

export type DemoEvent =
  | { type: 'walletConnected'; eoa: string }
  | { type: 'walletDisconnected' }
  | { type: 'authenticated' }
  | { type: 'authenticationCleared' }
  | { type: 'monadTestnetChanged'; ready: boolean }
  | { type: 'safeDerivationVerified'; address?: string }
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

  // An activation request is in flight. Late UI/provider events cannot alter
  // its account-bound preconditions or start a second activation.
  if (state.status === 'activationPending') {
    if (event.type === 'activationSucceeded') {
      return normalise({ ...state, safeDeployed: true })
    }
    if (event.type === 'activationFailed') {
      return { ...state, status: 'failed', error: event.error || 'Activation failed' }
    }
    if (event.type === 'activationStarted') {
      throw new Error('activation is already pending')
    }
    return state
  }

  if (event.type === 'activationSucceeded' || event.type === 'activationFailed') {
    throw new Error('activation is not pending')
  }
  if (state.status === 'failed') {
    throw new Error('clear or disconnect a failed demo state before continuing')
  }

  switch (event.type) {
    case 'walletConnected': {
      if (state.connectedEoa !== undefined && state.connectedEoa !== event.eoa) {
        return normalise({
          ...state,
          connectedEoa: event.eoa,
          authenticated: false,
          safeDerivationVerified: false,
          counterfactualSafeAddress: undefined,
          safeDeployed: false,
          sponsorReady: false
        })
      }
      return normalise({ ...state, walletConnected: true, connectedEoa: event.eoa })
    }
    case 'authenticated':
      if (!state.walletConnected) throw new Error('wallet connection is required before authentication')
      return normalise({ ...state, authenticated: true })
    case 'authenticationCleared':
      return normalise({
        ...state,
        authenticated: false,
        safeDerivationVerified: false,
        counterfactualSafeAddress: undefined,
        sponsorReady: false
      })
    case 'monadTestnetChanged':
      return normalise({ ...state, onMonadTestnet: event.ready })
    case 'safeDerivationVerified':
      if (!state.walletConnected || !state.authenticated) {
        throw new Error('wallet connection and authentication are required before Safe derivation')
      }
      return normalise({ ...state, safeDerivationVerified: true, counterfactualSafeAddress: event.address })
    case 'sponsorReadinessChanged':
      if (event.ready && (!state.walletConnected || !state.authenticated || !state.safeDerivationVerified)) {
        throw new Error('verified wallet, authentication and Safe derivation are required before sponsor readiness')
      }
      return normalise({ ...state, sponsorReady: event.ready })
    case 'activationStarted':
      if (!isDrawAvailable(state)) throw new Error('activation prerequisites are not ready')
      return { ...state, status: 'activationPending' }
  }
}
