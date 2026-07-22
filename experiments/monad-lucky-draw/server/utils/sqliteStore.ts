import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildCanonicalLoginMessage } from './auth'
import type { AuthClaimStore, AuditRecord, NonceRecord, SessionRecord } from './store'

export interface SqliteAuthClaimStore extends AuthClaimStore {
  readonly path: string
  canonicalMessage(nonce: NonceRecord): string
  auditCount(): number
  close(): void
}

const normalizeAddress = (value: string) => value.toLowerCase()
const rowToNonce = (row: Record<string, unknown>): NonceRecord => ({ id: String(row.id), eoa: String(row.eoa), origin: String(row.origin), issuedAt: Number(row.issued_at), expiresAt: Number(row.expires_at), used: Number(row.used) === 1 })
const rowToSession = (row: Record<string, unknown>): SessionRecord => ({ id: String(row.id), eoa: String(row.eoa), expiresAt: Number(row.expires_at), used: Number(row.used) === 1 })

/** Local-only durable state. Database files remain outside public/browser build output. */
export function createSqliteStore(databasePath: string): SqliteAuthClaimStore {
  const path = resolve(databasePath)
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const database = new DatabaseSync(path)
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS auth_nonce (id TEXT PRIMARY KEY, eoa TEXT NOT NULL, origin TEXT NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS auth_session (id TEXT PRIMARY KEY, eoa TEXT NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sponsor_claim (claim_id TEXT PRIMARY KEY, eoa TEXT NOT NULL UNIQUE, safe TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_record (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, eoa TEXT, created_at INTEGER NOT NULL, outcome TEXT NOT NULL);
  `)
  const consume = <T>(selectSql: string, updateSql: string, id: string, now: number, mapper: (row: Record<string, unknown>) => T): T | undefined => {
    database.exec('BEGIN IMMEDIATE')
    try {
      const row = database.prepare(selectSql).get(id, now) as Record<string, unknown> | undefined
      if (!row) { database.exec('COMMIT'); return undefined }
      database.prepare(updateSql).run(id)
      database.exec('COMMIT')
      return mapper(row)
    } catch (error) { database.exec('ROLLBACK'); throw error }
  }
  return {
    persistence: 'persistent', path,
    issueNonce({ eoa, origin, now, ttlMs }) { const record: NonceRecord = { id: `nonce-${randomUUID()}`, eoa: normalizeAddress(eoa), origin, issuedAt: now, expiresAt: now + ttlMs, used: false }; database.prepare('INSERT INTO auth_nonce (id, eoa, origin, issued_at, expires_at, used) VALUES (?, ?, ?, ?, ?, 0)').run(record.id, record.eoa, record.origin, record.issuedAt, record.expiresAt); return record },
    readNonce(id, now) { const row = database.prepare('SELECT * FROM auth_nonce WHERE id = ? AND used = 0 AND expires_at > ?').get(id, now) as Record<string, unknown> | undefined; return row ? rowToNonce(row) : undefined },
    consumeNonce(id, now) { return consume('SELECT * FROM auth_nonce WHERE id = ? AND used = 0 AND expires_at > ?', 'UPDATE auth_nonce SET used = 1 WHERE id = ?', id, now, rowToNonce) },
    saveSession(session) { database.prepare('INSERT INTO auth_session (id, eoa, expires_at, used) VALUES (?, ?, ?, ?)').run(session.id, normalizeAddress(session.eoa), session.expiresAt, session.used ? 1 : 0) },
    consumeSession(id, now) { return consume('SELECT * FROM auth_session WHERE id = ? AND used = 0 AND expires_at > ?', 'UPDATE auth_session SET used = 1 WHERE id = ?', id, now, rowToSession) },
    claimOnce({ claimId, eoa, safe }) { return database.prepare('INSERT OR IGNORE INTO sponsor_claim (claim_id, eoa, safe, created_at) VALUES (?, ?, ?, ?)').run(claimId, normalizeAddress(eoa), normalizeAddress(safe), Date.now()).changes === 1 },
    recordAudit({ event, eoa, now, outcome }: AuditRecord) { database.prepare('INSERT INTO audit_record (event, eoa, created_at, outcome) VALUES (?, ?, ?, ?)').run(event, eoa ? normalizeAddress(eoa) : null, now, outcome) },
    canonicalMessage(nonce) { return buildCanonicalLoginMessage({ eoa: nonce.eoa, nonce: nonce.id, origin: nonce.origin, issuedAt: nonce.issuedAt, expiresAt: nonce.expiresAt }) },
    auditCount() { return Number((database.prepare('SELECT COUNT(*) AS count FROM audit_record').get() as { count: number }).count) },
    close() { database.close() }
  }
}

export const persistentStore = createSqliteStore(resolve(process.cwd(), 'data', 'lucky-draw.sqlite'))
