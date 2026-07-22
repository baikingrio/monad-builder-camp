import { randomUUID } from 'node:crypto'
import { verifyMessage } from 'viem'
import { buildLoginMessage } from '../../app/lib/authMessage'
import type { AuthClaimStore, NonceRecord, SessionRecord } from './store'

export function buildCanonicalLoginMessage(input: { eoa: string; nonce: string; origin: string; issuedAt: number; expiresAt: number }): string {
  return buildLoginMessage({ eoa: input.eoa, nonce: input.nonce, origin: input.origin, issuedAt: new Date(input.issuedAt).toISOString(), expiresAt: new Date(input.expiresAt).toISOString() }).text
}

export type LoginVerification =
  | { authenticated: true; eoa: string; session: SessionRecord; persistence: AuthClaimStore['persistence'] }
  | { authenticated: false; reason: 'invalid-or-used-nonce' | 'message-mismatch' | 'invalid-signature'; persistence: AuthClaimStore['persistence'] }

export interface VerifyEoaLoginInput { eoa: string; origin: string; nonce: string; message: string; signature: string; now: number }

/** Verifies exactly the server-issued message, then atomically consumes its nonce before issuing an owner-bound session. */
export async function verifyEoaLogin(store: AuthClaimStore, input: VerifyEoaLoginInput): Promise<LoginVerification> {
  const rejected = (reason: Extract<LoginVerification, { authenticated: false }>['reason']): LoginVerification => {
    store.recordAudit({ event: 'eoa-login', now: input.now, outcome: 'rejected' })
    return { authenticated: false, reason, persistence: store.persistence }
  }
  const nonce = store.readNonce(input.nonce, input.now)
  if (!nonce || nonce.eoa !== input.eoa.toLowerCase() || nonce.origin !== input.origin) return rejected('invalid-or-used-nonce')

  const canonicalMessage = buildCanonicalLoginMessage({
    eoa: nonce.eoa,
    nonce: nonce.id,
    origin: nonce.origin,
    issuedAt: nonce.issuedAt,
    expiresAt: nonce.expiresAt
  })
  if (input.message !== canonicalMessage) return rejected('message-mismatch')

  try {
    const valid = await verifyMessage({ address: nonce.eoa as `0x${string}`, message: canonicalMessage, signature: input.signature as `0x${string}` })
    if (!valid) return rejected('invalid-signature')
  } catch {
    return rejected('invalid-signature')
  }

  // The only replay boundary: concurrent successful verifications race here and exactly one consumes the nonce.
  if (!store.consumeNonce(nonce.id, input.now)) return rejected('invalid-or-used-nonce')

  const session: SessionRecord = { id: `session-${randomUUID()}`, eoa: nonce.eoa, expiresAt: nonce.expiresAt, used: false }
  store.saveSession(session)
  store.recordAudit({ event: 'eoa-login', eoa: nonce.eoa, now: input.now, outcome: 'accepted' })
  return { authenticated: true, eoa: nonce.eoa, session, persistence: store.persistence }
}

/** Compatibility boundary retained for callers that have no server-side nonce store. Never authenticates. */
export function verifyLoginBoundary(input: { canonicalMessage: string; suppliedMessage: string; signature: string; cryptographicallyVerified: boolean }): Extract<LoginVerification, { authenticated: false }> {
  if (input.suppliedMessage !== input.canonicalMessage) return { authenticated: false, reason: 'message-mismatch', persistence: 'development-only' }
  return { authenticated: false, reason: 'invalid-signature', persistence: 'development-only' }
}
