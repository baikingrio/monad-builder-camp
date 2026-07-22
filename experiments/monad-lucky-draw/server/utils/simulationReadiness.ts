import { createFixedV07SimulationPreparation, type ConfirmedCounterfactualSafeState, type SimulationPreparationOverrides } from '../../app/lib/userOperationSimulation'
import { MONAD_ACTIVATION_CONFIG } from '../../app/lib/monadConfig'
import type { AuthClaimStore } from './store'

export interface SimulationReadinessInput {
  readonly sessionId?: string
  readonly safe?: ConfirmedCounterfactualSafeState
  readonly userClicked?: boolean
  /** Kept solely so server-side validation can reject client tampering explicitly. */
  readonly overrides?: SimulationPreparationOverrides
}

export type SimulationReadinessResponse = Readonly<{
  enabled: false
  contactedBundler: false
  sponsorUsed: false
  blockers: readonly string[]
  metadata: Readonly<{ chainId: 10143; entryPoint: string; safeFactory: string; target: string; drawSelector: string; value: '0'; mode: 'preparation-only' }>
}>

/**
 * Validates readiness without calling any remote service. In particular, this
 * function intentionally does not expose a Bundler, Pimlico, Paymaster, Sponsor,
 * signer, or UserOperation submission dependency.
 */
export function evaluateFixedSimulationReadiness(store: AuthClaimStore, input: SimulationReadinessInput, now: number): SimulationReadinessResponse {
  const blockers: string[] = []
  const session = typeof input.sessionId === 'string' && input.sessionId.length > 0 ? store.readSession(input.sessionId, now) : undefined
  if (!session) blockers.push('a verified, unexpired user session is required')
  if (!input.userClicked) blockers.push('an explicit user simulation-preview click is required')

  if (session && input.userClicked) {
    try {
      createFixedV07SimulationPreparation({
        config: MONAD_ACTIVATION_CONFIG,
        ownerAuthorization: { owner: session.eoa, cryptographicallyVerified: true },
        safe: input.safe,
        userClicked: true
      }, input.overrides)
    } catch (error) {
      blockers.push(error instanceof Error ? error.message : 'fixed simulation preparation validation failed')
    }
  }

  return Object.freeze({
    enabled: false,
    contactedBundler: false,
    sponsorUsed: false,
    blockers: Object.freeze(blockers),
    metadata: Object.freeze({ chainId: 10143, entryPoint: MONAD_ACTIVATION_CONFIG.entryPoint, safeFactory: MONAD_ACTIVATION_CONFIG.safeFactory, target: MONAD_ACTIVATION_CONFIG.luckyDraw, drawSelector: '0x35d1193c', value: '0', mode: 'preparation-only' })
  })
}
