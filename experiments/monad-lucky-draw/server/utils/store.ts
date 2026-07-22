export type PersistenceKind = 'development-only' | 'persistent'

export interface NonceRecord { id: string; eoa: string; origin: string; issuedAt: number; expiresAt: number; used: boolean }
export interface SessionRecord { id: string; eoa: string; expiresAt: number; used: boolean }
export interface AuditRecord { event: string; eoa?: string; now: number; outcome: 'accepted' | 'rejected' }

export interface AuthClaimStore {
  readonly persistence: PersistenceKind
  issueNonce(input: { eoa: string; origin: string; now: number; ttlMs: number }): NonceRecord
  readNonce(id: string, now: number): NonceRecord | undefined
  consumeNonce(id: string, now: number): NonceRecord | undefined
  saveSession(session: SessionRecord): void
  consumeSession(id: string, now: number): SessionRecord | undefined
  claimOnce(input: { claimId: string; eoa: string; safe: string }): boolean
  recordAudit(record: AuditRecord): void
}

const normalizeAddress = (value: string) => value.toLowerCase()

/** Test-only in-memory implementation. Production routes use sqliteStore.ts. */
export function createDevelopmentStore(): AuthClaimStore {
  const nonces = new Map<string, NonceRecord>()
  const sessions = new Map<string, SessionRecord>()
  const claims = new Set<string>()
  let counter = 0
  const nextId = (prefix: string) => `${prefix}-${(++counter).toString().padStart(16, '0')}`
  return {
    persistence: 'development-only',
    issueNonce({ eoa, origin, now, ttlMs }) { const record = { id: nextId('nonce'), eoa: normalizeAddress(eoa), origin, issuedAt: now, expiresAt: now + ttlMs, used: false }; nonces.set(record.id, record); return { ...record } },
    readNonce(id, now) { const record = nonces.get(id); return !record || record.used || record.expiresAt <= now ? undefined : { ...record } },
    consumeNonce(id, now) { const record = nonces.get(id); if (!record || record.used || record.expiresAt <= now) return undefined; record.used = true; return { ...record } },
    saveSession(session) { sessions.set(session.id, { ...session, eoa: normalizeAddress(session.eoa) }) },
    consumeSession(id, now) { const session = sessions.get(id); if (!session || session.used || session.expiresAt <= now) return undefined; session.used = true; return { ...session } },
    claimOnce({ claimId, eoa, safe }) { const keys = [`claim:${claimId}`, `eoa:${normalizeAddress(eoa)}`, `safe:${normalizeAddress(safe)}`]; if (keys.some((key) => claims.has(key))) return false; keys.forEach((key) => claims.add(key)); return true },
    recordAudit() {}
  }
}

export const developmentStore = createDevelopmentStore()
