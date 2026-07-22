import { buildCanonicalLoginMessage } from '../../utils/auth'
import { persistentStore } from '../../utils/sqliteStore'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const eoa = typeof query.eoa === 'string' ? query.eoa : ''
  const origin = typeof query.origin === 'string' ? query.origin : ''
  const now = Date.now()
  try {
    const nonce = persistentStore.issueNonce({ eoa, origin, now, ttlMs: 5 * 60_000 })
    return {
      persistence: persistentStore.persistence,
      nonce: nonce.id,
      issuedAt: new Date(nonce.issuedAt).toISOString(),
      expiresAt: new Date(nonce.expiresAt).toISOString(),
      message: buildCanonicalLoginMessage({ eoa: nonce.eoa, nonce: nonce.id, origin: nonce.origin, issuedAt: nonce.issuedAt, expiresAt: nonce.expiresAt })
    }
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'invalid login request' })
  }
})
