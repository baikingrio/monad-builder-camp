import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildCanonicalLoginMessage } from './auth'
import type { AuthClaimStore, AuditRecord, NonceRecord, SessionRecord } from './store'

export interface SessionGrantRecord {
  readonly eoa: string
  readonly safe: string
  readonly sessionAddress: string
  readonly expiresAt: number
  readonly remainingCalls: number
  readonly status: 'pending' | 'active'
  /** Product path used for this grant. Defaults to legacy for existing rows. */
  readonly mode: 'legacy' | 'roles'
  /** Roles modifier proxy for mode=roles grants. */
  readonly rolesModifier?: string
}

export interface SessionDrawPreparationRecord {
  readonly id: string
  readonly eoa: string
  readonly safe: string
  readonly sessionAddress: string
  readonly userOperation: Record<string, unknown>
  readonly expiresAt: number
  /** Optional Roles EOA tx payload when mode=roles. */
  readonly rolesTransaction?: {
    readonly to: string
    readonly value: string
    readonly data: string
    readonly rolesModifier: string
  }
}

export interface SqliteAuthClaimStore extends AuthClaimStore {
  readonly path: string
  canonicalMessage(nonce: NonceRecord): string
  auditCount(): number
  getSponsorSpent(): bigint
  addSponsorSpent(amount: bigint): void
  hasSponsorClaim(input: { eoa: string; safe: string }): string | undefined
  /** Reserve a one-time claim. Pending claims are reusable after failed activate/submit. */
  reserveSponsorClaim(input: { claimId: string; eoa: string; safe: string }): { ok: true; claimId: string; reused: boolean } | { ok: false; reason: 'completed' }
  completeSponsorClaim(input: { eoa: string; safe: string }): boolean
  upsertPendingSessionGrant(input: {
    eoa: string
    safe: string
    sessionAddress: string
    expiresAt: number
    remainingCalls: number
    now: number
    mode?: 'legacy' | 'roles'
    rolesModifier?: string
  }): SessionGrantRecord
  activateSessionGrant(input: { eoa: string; safe: string; sessionAddress: string }): boolean
  readActiveSessionGrant(input: { eoa: string; safe: string; now: number }): SessionGrantRecord | undefined
  consumeSessionGrantCall(input: { eoa: string; safe: string }): boolean
  saveSessionDrawPreparation(input: {
    eoa: string
    safe: string
    sessionAddress: string
    userOperation: Record<string, unknown>
    expiresAt: number
    now: number
    rolesTransaction?: SessionDrawPreparationRecord['rolesTransaction']
  }): SessionDrawPreparationRecord
  /** Claims exactly once before broadcast; failed broadcasts deliberately require a fresh preparation. */
  claimSessionDrawPreparation(input: { preparationId: string; eoa: string; safe: string; now: number }): SessionDrawPreparationRecord | undefined
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
    CREATE TABLE IF NOT EXISTS sponsor_claim (claim_id TEXT PRIMARY KEY, eoa TEXT NOT NULL UNIQUE, safe TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending');
    CREATE TABLE IF NOT EXISTS audit_record (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, eoa TEXT, created_at INTEGER NOT NULL, outcome TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sponsor_budget (id INTEGER PRIMARY KEY CHECK (id = 1), spent TEXT NOT NULL);
    INSERT OR IGNORE INTO sponsor_budget (id, spent) VALUES (1, '0');
    CREATE TABLE IF NOT EXISTS session_grant (
      eoa TEXT NOT NULL,
      safe TEXT NOT NULL,
      session_address TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      remaining_calls INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','active')),
      created_at INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'legacy',
      roles_modifier TEXT,
      PRIMARY KEY (eoa, safe)
    );
    CREATE TABLE IF NOT EXISTS session_draw_preparation (
      id TEXT PRIMARY KEY, eoa TEXT NOT NULL, safe TEXT NOT NULL, session_address TEXT NOT NULL,
      user_operation_json TEXT NOT NULL, expires_at INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('prepared','claimed')), created_at INTEGER NOT NULL,
      roles_transaction_json TEXT
    );
  `)
  // Existing demo DBs created before status existed.
  try {
    database.exec(`ALTER TABLE sponsor_claim ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`)
  } catch {
    // column already present
  }
  try {
    database.exec(`ALTER TABLE session_grant ADD COLUMN mode TEXT NOT NULL DEFAULT 'legacy'`)
  } catch {
    // column already present
  }
  try {
    database.exec(`ALTER TABLE session_grant ADD COLUMN roles_modifier TEXT`)
  } catch {
    // column already present
  }
  try {
    database.exec(`ALTER TABLE session_draw_preparation ADD COLUMN roles_transaction_json TEXT`)
  } catch {
    // column already present
  }
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
    readSession(id, now) { const row = database.prepare('SELECT * FROM auth_session WHERE id = ? AND used = 0 AND expires_at > ?').get(id, now) as Record<string, unknown> | undefined; return row ? rowToSession(row) : undefined },
    consumeSession(id, now) { return consume('SELECT * FROM auth_session WHERE id = ? AND used = 0 AND expires_at > ?', 'UPDATE auth_session SET used = 1 WHERE id = ?', id, now, rowToSession) },
    claimOnce({ claimId, eoa, safe }) {
      // Legacy single-insert API used by auth/sponsor policy tests.
      return database.prepare(
        'INSERT OR IGNORE INTO sponsor_claim (claim_id, eoa, safe, created_at, status) VALUES (?, ?, ?, ?, ?)'
      ).run(claimId, normalizeAddress(eoa), normalizeAddress(safe), Date.now(), 'pending').changes === 1
    },
    hasSponsorClaim({ eoa, safe }) {
      const row = database.prepare('SELECT claim_id FROM sponsor_claim WHERE eoa = ? AND safe = ?').get(normalizeAddress(eoa), normalizeAddress(safe)) as { claim_id: string } | undefined
      return row?.claim_id
    },
    reserveSponsorClaim({ claimId, eoa, safe }) {
      const eoaKey = normalizeAddress(eoa)
      const safeKey = normalizeAddress(safe)
      const existing = database.prepare('SELECT claim_id, status FROM sponsor_claim WHERE eoa = ? OR safe = ?').get(eoaKey, safeKey) as { claim_id: string; status: string } | undefined
      if (existing?.status === 'completed') return { ok: false, reason: 'completed' }
      if (existing) {
        database.prepare('DELETE FROM sponsor_claim WHERE claim_id = ?').run(existing.claim_id)
      }
      const inserted = database.prepare(
        'INSERT INTO sponsor_claim (claim_id, eoa, safe, created_at, status) VALUES (?, ?, ?, ?, ?)'
      ).run(claimId, eoaKey, safeKey, Date.now(), 'pending').changes === 1
      if (!inserted) return { ok: false, reason: 'completed' }
      return { ok: true, claimId, reused: Boolean(existing) }
    },
    completeSponsorClaim({ eoa, safe }) {
      return database.prepare(
        "UPDATE sponsor_claim SET status = 'completed' WHERE eoa = ? AND safe = ? AND status = 'pending'"
      ).run(normalizeAddress(eoa), normalizeAddress(safe)).changes === 1
    },
    recordAudit({ event, eoa, now, outcome }: AuditRecord) { database.prepare('INSERT INTO audit_record (event, eoa, created_at, outcome) VALUES (?, ?, ?, ?)').run(event, eoa ? normalizeAddress(eoa) : null, now, outcome) },
    canonicalMessage(nonce) { return buildCanonicalLoginMessage({ eoa: nonce.eoa, nonce: nonce.id, origin: nonce.origin, issuedAt: nonce.issuedAt, expiresAt: nonce.expiresAt }) },
    auditCount() { return Number((database.prepare('SELECT COUNT(*) AS count FROM audit_record').get() as { count: number }).count) },
    getSponsorSpent() {
      const row = database.prepare('SELECT spent FROM sponsor_budget WHERE id = 1').get() as { spent: string } | undefined
      return BigInt(row?.spent ?? '0')
    },
    addSponsorSpent(amount) {
      if (amount <= 0n) return
      database.exec('BEGIN IMMEDIATE')
      try {
        const row = database.prepare('SELECT spent FROM sponsor_budget WHERE id = 1').get() as { spent: string }
        const next = (BigInt(row.spent) + amount).toString()
        database.prepare('UPDATE sponsor_budget SET spent = ? WHERE id = 1').run(next)
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    },
    upsertPendingSessionGrant({ eoa, safe, sessionAddress, expiresAt, remainingCalls, now, mode, rolesModifier }) {
      const record: SessionGrantRecord = {
        eoa: normalizeAddress(eoa),
        safe: normalizeAddress(safe),
        sessionAddress: normalizeAddress(sessionAddress),
        expiresAt,
        remainingCalls,
        status: 'pending',
        mode: mode === 'roles' ? 'roles' : 'legacy',
        rolesModifier: rolesModifier ? normalizeAddress(rolesModifier) : undefined
      }
      database.prepare(`
        INSERT INTO session_grant (eoa, safe, session_address, expires_at, remaining_calls, status, created_at, mode, roles_modifier)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
        ON CONFLICT(eoa, safe) DO UPDATE SET
          session_address = excluded.session_address,
          expires_at = excluded.expires_at,
          remaining_calls = excluded.remaining_calls,
          status = 'pending',
          created_at = excluded.created_at,
          mode = excluded.mode,
          roles_modifier = excluded.roles_modifier
      `).run(
        record.eoa,
        record.safe,
        record.sessionAddress,
        record.expiresAt,
        record.remainingCalls,
        now,
        record.mode,
        record.rolesModifier ?? null
      )
      return record
    },
    activateSessionGrant({ eoa, safe, sessionAddress }) {
      return database.prepare(`
        UPDATE session_grant SET status = 'active'
        WHERE eoa = ? AND safe = ? AND session_address = ? AND status = 'pending'
      `).run(normalizeAddress(eoa), normalizeAddress(safe), normalizeAddress(sessionAddress)).changes === 1
    },
    readActiveSessionGrant({ eoa, safe, now }) {
      const row = database.prepare(`
        SELECT eoa, safe, session_address, expires_at, remaining_calls, status, mode, roles_modifier
        FROM session_grant
        WHERE eoa = ? AND safe = ? AND status = 'active' AND expires_at > ?
          AND (mode = 'roles' OR remaining_calls > 0)
      `).get(normalizeAddress(eoa), normalizeAddress(safe), now) as
        | {
          eoa: string
          safe: string
          session_address: string
          expires_at: number
          remaining_calls: number
          status: 'active'
          mode?: string
          roles_modifier?: string | null
        }
        | undefined
      if (!row) return undefined
      return {
        eoa: row.eoa,
        safe: row.safe,
        sessionAddress: row.session_address,
        expiresAt: row.expires_at,
        remainingCalls: row.remaining_calls,
        status: row.status,
        mode: row.mode === 'roles' ? 'roles' : 'legacy',
        rolesModifier: row.roles_modifier ? String(row.roles_modifier) : undefined
      }
    },
    consumeSessionGrantCall({ eoa, safe }) {
      // Roles self-paid path: no call cap — only confirm the grant is still active.
      const rolesTouched = database.prepare(`
        UPDATE session_grant SET remaining_calls = remaining_calls
        WHERE eoa = ? AND safe = ? AND status = 'active' AND mode = 'roles'
      `).run(normalizeAddress(eoa), normalizeAddress(safe)).changes === 1
      if (rolesTouched) return true
      return database.prepare(`
        UPDATE session_grant SET remaining_calls = remaining_calls - 1
        WHERE eoa = ? AND safe = ? AND status = 'active' AND remaining_calls > 0 AND mode != 'roles'
      `).run(normalizeAddress(eoa), normalizeAddress(safe)).changes === 1
    },
    saveSessionDrawPreparation({ eoa, safe, sessionAddress, userOperation, expiresAt, now, rolesTransaction }) {
      const record: SessionDrawPreparationRecord = {
        id: `session-draw-${randomUUID()}`,
        eoa: normalizeAddress(eoa),
        safe: normalizeAddress(safe),
        sessionAddress: normalizeAddress(sessionAddress),
        userOperation: JSON.parse(JSON.stringify(userOperation)) as Record<string, unknown>,
        expiresAt,
        rolesTransaction: rolesTransaction
          ? {
              to: normalizeAddress(rolesTransaction.to),
              value: rolesTransaction.value,
              data: rolesTransaction.data,
              rolesModifier: normalizeAddress(rolesTransaction.rolesModifier)
            }
          : undefined
      }
      database.prepare(`INSERT INTO session_draw_preparation (id, eoa, safe, session_address, user_operation_json, expires_at, status, created_at, roles_transaction_json) VALUES (?, ?, ?, ?, ?, ?, 'prepared', ?, ?)`)
        .run(
          record.id,
          record.eoa,
          record.safe,
          record.sessionAddress,
          JSON.stringify(record.userOperation),
          record.expiresAt,
          now,
          record.rolesTransaction ? JSON.stringify(record.rolesTransaction) : null
        )
      return record
    },
    claimSessionDrawPreparation({ preparationId, eoa, safe, now }) {
      database.exec('BEGIN IMMEDIATE')
      try {
        const row = database.prepare(`SELECT * FROM session_draw_preparation WHERE id = ? AND eoa = ? AND safe = ? AND status = 'prepared' AND expires_at > ?`).get(preparationId, normalizeAddress(eoa), normalizeAddress(safe), now) as Record<string, unknown> | undefined
        if (!row) { database.exec('COMMIT'); return undefined }
        const changes = database.prepare("UPDATE session_draw_preparation SET status = 'claimed' WHERE id = ? AND status = 'prepared'").run(preparationId).changes
        database.exec('COMMIT')
        if (changes !== 1) return undefined
        const rolesRaw = row.roles_transaction_json
        return {
          id: String(row.id),
          eoa: String(row.eoa),
          safe: String(row.safe),
          sessionAddress: String(row.session_address),
          userOperation: JSON.parse(String(row.user_operation_json)) as Record<string, unknown>,
          expiresAt: Number(row.expires_at),
          rolesTransaction: typeof rolesRaw === 'string' && rolesRaw.length > 0
            ? JSON.parse(rolesRaw) as SessionDrawPreparationRecord['rolesTransaction']
            : undefined
        }
      } catch (error) { database.exec('ROLLBACK'); throw error }
    },
    close() { database.close() }
  }
}

export const persistentStore = createSqliteStore(resolve(process.cwd(), 'data', 'lucky-draw.sqlite'))
