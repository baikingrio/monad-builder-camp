// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { privateKeyToAccount } from 'viem/accounts'
import { createSqliteStore } from '../server/utils/sqliteStore'
import { verifyEoaLogin } from '../server/utils/auth'

const NOW = Date.parse('2026-07-22T12:00:00.000Z')
const ORIGIN = 'https://draw.example'
const owner = privateKeyToAccount('0x59c6995e998f97a5a0044976f0945385d5b3f43f7f5e7d6a3e2f4f8b0d0f8a8c')
const other = privateKeyToAccount('0x8b3a350cf5c34c9194ca3a545d9b8d5f2b2e7b0f80c7d660d64f4c4df14cbb4f')
const directories: string[] = []

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })))

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'lucky-draw-auth-'))
  directories.push(directory)
  return { store: createSqliteStore(join(directory, 'state.sqlite')), directory }
}

async function signedLogin(store: ReturnType<typeof createSqliteStore>, signer = owner, overrides: { eoa?: string; origin?: string; now?: number; ttlMs?: number } = {}) {
  const now = overrides.now ?? NOW
  const eoa = overrides.eoa ?? owner.address
  const origin = overrides.origin ?? ORIGIN
  const nonce = store.issueNonce({ eoa, origin, now, ttlMs: overrides.ttlMs ?? 60_000 })
  const message = store.canonicalMessage(nonce)
  const signature = await signer.signMessage({ message })
  return { nonce, message, signature, eoa, origin, now }
}

describe('durable cryptographic EOA login', () => {
  it('accepts a valid signed canonical login and issues an owner-bound expiring session', async () => {
    const { store } = fixture()
    const login = await signedLogin(store)

    const result = await verifyEoaLogin(store, { eoa: login.eoa, origin: login.origin, nonce: login.nonce.id, message: login.message, signature: login.signature, now: login.now })

    expect(result).toMatchObject({ authenticated: true, eoa: owner.address.toLowerCase(), persistence: 'persistent' })
    if (result.authenticated) expect(store.consumeSession(result.session.id, NOW)).toMatchObject({ eoa: owner.address.toLowerCase(), expiresAt: NOW + 60_000 })
  })

  it('rejects a signature from a different signer without issuing a session', async () => {
    const { store } = fixture()
    const login = await signedLogin(store, other)
    await expect(verifyEoaLogin(store, { eoa: login.eoa, origin: login.origin, nonce: login.nonce.id, message: login.message, signature: login.signature, now: NOW })).resolves.toMatchObject({ authenticated: false, reason: 'invalid-signature' })
  })

  it('rejects replay after atomically consuming the nonce', async () => {
    const { store } = fixture()
    const login = await signedLogin(store)
    const input = { eoa: login.eoa, origin: login.origin, nonce: login.nonce.id, message: login.message, signature: login.signature, now: NOW }
    await expect(verifyEoaLogin(store, input)).resolves.toMatchObject({ authenticated: true })
    await expect(verifyEoaLogin(store, input)).resolves.toMatchObject({ authenticated: false, reason: 'invalid-or-used-nonce' })
  })

  it('rejects an expired login', async () => {
    const { store } = fixture()
    const login = await signedLogin(store, owner, { ttlMs: 1 })
    await expect(verifyEoaLogin(store, { eoa: login.eoa, origin: login.origin, nonce: login.nonce.id, message: login.message, signature: login.signature, now: NOW + 1 })).resolves.toMatchObject({ authenticated: false, reason: 'invalid-or-used-nonce' })
  })

  it('rejects an origin mismatch', async () => {
    const { store } = fixture()
    const login = await signedLogin(store)
    await expect(verifyEoaLogin(store, { eoa: login.eoa, origin: 'https://attacker.example', nonce: login.nonce.id, message: login.message, signature: login.signature, now: NOW })).resolves.toMatchObject({ authenticated: false, reason: 'invalid-or-used-nonce' })
  })

  it('persists nonce, sessions, sponsor claims, and audit records when reopened', () => {
    const { store, directory } = fixture()
    const nonce = store.issueNonce({ eoa: owner.address, origin: ORIGIN, now: NOW, ttlMs: 60_000 })
    store.saveSession({ id: 'session-persisted', eoa: owner.address, expiresAt: NOW + 60_000, used: false })
    expect(store.claimOnce({ claimId: 'claim-000000000001', eoa: owner.address, safe: other.address })).toBe(true)
    store.recordAudit({ event: 'test', eoa: owner.address, now: NOW, outcome: 'accepted' })
    store.close()

    const reopened = createSqliteStore(join(directory, 'state.sqlite'))
    expect(reopened.consumeNonce(nonce.id, NOW)).toMatchObject({ id: nonce.id })
    expect(reopened.consumeSession('session-persisted', NOW)).toMatchObject({ eoa: owner.address.toLowerCase() })
    expect(reopened.claimOnce({ claimId: 'claim-000000000001', eoa: owner.address, safe: other.address })).toBe(false)
    expect(reopened.auditCount()).toBe(1)
    reopened.close()
  })

  it('returns generic failures and never leaks supplied secrets', async () => {
    const { store } = fixture()
    const secret = 'test-only-secret-that-must-not-leak'
    const result = await verifyEoaLogin(store, { eoa: owner.address, origin: ORIGIN, nonce: secret, message: secret, signature: `0x${'00'.repeat(65)}`, now: NOW })
    expect(JSON.stringify(result)).not.toContain(secret)
  })
})
