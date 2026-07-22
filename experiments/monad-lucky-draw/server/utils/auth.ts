import { buildLoginMessage } from '../../app/lib/authMessage'

export function buildCanonicalLoginMessage(input: { eoa: string; nonce: string; origin: string; issuedAt: number; expiresAt: number }): string {
  return buildLoginMessage({
    eoa: input.eoa,
    nonce: input.nonce,
    origin: input.origin,
    issuedAt: new Date(input.issuedAt).toISOString(),
    expiresAt: new Date(input.expiresAt).toISOString()
  }).text
}

export type LoginVerification = { authenticated: true; eoa: string } | { authenticated: false; reason: 'message-mismatch' | 'unsigned-proof' | 'signature-verification-unavailable' }

/** A route boundary, not a cryptographic verifier: browser recovery must be added before this can authenticate. */
export function verifyLoginBoundary(input: { canonicalMessage: string; suppliedMessage: string; signature: string; cryptographicallyVerified: boolean }): LoginVerification {
  if (input.suppliedMessage !== input.canonicalMessage) return { authenticated: false, reason: 'message-mismatch' }
  if (!/^0x[0-9a-fA-F]{2,}$/.test(input.signature)) return { authenticated: false, reason: 'unsigned-proof' }
  // Deliberately never trusts a client boolean or unsigned/browser-unrecovered proof.
  return { authenticated: false, reason: 'signature-verification-unavailable' }
}
