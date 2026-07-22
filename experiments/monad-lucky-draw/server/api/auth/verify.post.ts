import { buildCanonicalLoginMessage, verifyLoginBoundary } from '../../utils/auth'
import { developmentStore } from '../../utils/store'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ eoa?: string; origin?: string; nonce?: string; message?: string; signature?: string }>(event)
  const now = Date.now()
  const nonce = typeof body?.nonce === 'string' ? developmentStore.consumeNonce(body.nonce, now) : undefined
  if (!nonce || body?.eoa !== nonce.eoa || body?.origin !== nonce.origin) {
    return { authenticated: false, reason: 'invalid-or-used-nonce', persistence: 'development-only' as const }
  }
  const canonicalMessage = buildCanonicalLoginMessage({ eoa: nonce.eoa, nonce: nonce.id, origin: nonce.origin, issuedAt: nonce.expiresAt - 5 * 60_000, expiresAt: nonce.expiresAt })
  const verification = verifyLoginBoundary({ canonicalMessage, suppliedMessage: body.message ?? '', signature: body.signature ?? '', cryptographicallyVerified: false })
  return { ...verification, persistence: 'development-only' as const }
})
