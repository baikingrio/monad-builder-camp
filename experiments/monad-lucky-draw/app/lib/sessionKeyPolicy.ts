import { MONAD_ACTIVATION_CONFIG } from './monadConfig'
import { LUCKY_DRAW_DRAW_SELECTOR } from './userOperationSimulation'

export const SESSION_KEY_MAX_CALLS = 3
export const SESSION_KEY_TTL_MS = 24 * 60 * 60 * 1000

export interface SessionKeyGrant {
  readonly eoa: string
  readonly safe: string
  readonly sessionAddress: string
  readonly expiresAt: number
  readonly remainingCalls: number
  /** True only after the on-chain addOwner UserOperation has been confirmed. */
  readonly onchainAuthorized: boolean
}

export type SessionKeyDecision = { allowed: true } | { allowed: false; reason: string }

const ADDRESS = /^0x[a-fA-F0-9]{40}$/i

export function evaluateSessionKeyDraw(input: {
  readonly grant: SessionKeyGrant
  readonly target: string
  readonly selector: string
  readonly value: bigint
  readonly now: number
}): SessionKeyDecision {
  if (!input.grant.onchainAuthorized) return { allowed: false, reason: 'session-not-onchain-authorized' }
  if (!ADDRESS.test(input.grant.sessionAddress) || !ADDRESS.test(input.grant.safe) || !ADDRESS.test(input.grant.eoa)) {
    return { allowed: false, reason: 'invalid-grant-accounts' }
  }
  if (input.now >= input.grant.expiresAt) return { allowed: false, reason: 'session-expired' }
  if (input.grant.remainingCalls <= 0) return { allowed: false, reason: 'session-exhausted' }
  if (input.target.toLowerCase() !== MONAD_ACTIVATION_CONFIG.luckyDraw.toLowerCase()) {
    return { allowed: false, reason: 'target-not-allowed' }
  }
  if (input.selector.toLowerCase() !== LUCKY_DRAW_DRAW_SELECTOR.toLowerCase()) {
    return { allowed: false, reason: 'selector-not-allowed' }
  }
  if (input.value !== 0n) return { allowed: false, reason: 'nonzero-value-not-allowed' }
  return { allowed: true }
}

export function createSessionKeyGrantDraft(input: {
  readonly eoa: string
  readonly safe: string
  readonly sessionAddress: string
  readonly now: number
}): Omit<SessionKeyGrant, 'onchainAuthorized'> & { onchainAuthorized: false } {
  if (!ADDRESS.test(input.eoa) || !ADDRESS.test(input.safe) || !ADDRESS.test(input.sessionAddress)) {
    throw new Error('session grant requires valid eoa, safe and session addresses')
  }
  return Object.freeze({
    eoa: input.eoa.toLowerCase(),
    safe: input.safe.toLowerCase(),
    sessionAddress: input.sessionAddress.toLowerCase(),
    expiresAt: input.now + SESSION_KEY_TTL_MS,
    remainingCalls: SESSION_KEY_MAX_CALLS,
    onchainAuthorized: false as const
  })
}
