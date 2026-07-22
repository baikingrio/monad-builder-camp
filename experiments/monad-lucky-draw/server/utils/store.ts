export type PersistenceKind = 'development-only' | 'persistent'

export interface NonceRecord { id: string; eoa: string; origin: string; expiresAt: number; used: boolean }
export interface SessionRecord { id: string; eoa: string; expiresAt: number; used: boolean }

/** Replacement boundary: a SQLite implementation must preserve these atomic consume semantics. */
export interface AuthClaimStore {
  readonly persistence: PersistenceKind
  issueNonce(input: { eoa: string; origin: string; now: number; ttlMs: number }): NonceRecord
  consumeNonce(id: string, now: number): NonceRecord | undefined
  saveSession(session: SessionRecord): void
  consumeSession(id: string, now: number): SessionRecord | undefined
  claimOnce(input: { claimId: string; eoa: string; safe: string }): boolean
}

export function createDevelopmentStore(): AuthClaimStore {
  const nonces = new Map<string, NonceRecord>()
  const sessions = new Map<string, SessionRecord>()
  const claims = new Set<string>()
  let counter = 0
  const nextId = (prefix: string) => `${prefix}-${(++counter).toString().padStart(16, '0')}`
  return {
    persistence: 'development-only',
    issueNonce({ eoa, origin, now, ttlMs }) {
      const record = { id: nextId('nonce'), eoa, origin, expiresAt: now + ttlMs, used: false }
      nonces.set(record.id, record)
      return { ...record }
    },
    consumeNonce(id, now) {
      const record = nonces.get(id)
      if (!record || record.used || record.expiresAt <= now) return undefined
      record.used = true
      return { ...record }
    },
    saveSession(session) { sessions.set(session.id, { ...session }) },
    consumeSession(id, now) {
      const session = sessions.get(id)
      if (!session || session.used || session.expiresAt <= now) return undefined
      session.used = true
      return { ...session }
    },
    claimOnce({ claimId, eoa, safe }) {
      const keys = [`claim:${claimId}`, `eoa:${eoa.toLowerCase()}`, `safe:${safe.toLowerCase()}`]
      if (keys.some((key) => claims.has(key))) return false
      keys.forEach((key) => claims.add(key))
      return true
    }
  }
}

export const developmentStore = createDevelopmentStore()
