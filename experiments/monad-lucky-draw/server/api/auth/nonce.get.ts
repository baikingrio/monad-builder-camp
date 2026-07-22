import { buildCanonicalLoginMessage } from '../../utils/auth'
import { developmentStore } from '../../utils/store'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const eoa = typeof query.eoa === 'string' ? query.eoa : ''
  const origin = typeof query.origin === 'string' ? query.origin : ''
  const now = Date.now()
  try {
    const nonce = developmentStore.issueNonce({ eoa, origin, now, ttlMs: 5 * 60_000 })
    return {
      persistence: 'development-only' as const,
      nonce: nonce.id,
      expiresAt: new Date(nonce.expiresAt).toISOString(),
      message: buildCanonicalLoginMessage({ eoa, nonce: nonce.id, origin, issuedAt: now, expiresAt: nonce.expiresAt })
    }
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'invalid login request' })
  }
})
