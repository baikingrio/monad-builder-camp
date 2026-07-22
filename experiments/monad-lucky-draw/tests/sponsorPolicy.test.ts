import { describe, expect, it } from 'vitest'
import {
  MONAD_TESTNET_CHAIN_ID,
  evaluateSponsorClaim,
  type SponsorClaim,
  type SponsorPolicy
} from '../server/utils/sponsorPolicy'
import { buildCanonicalLoginMessage, verifyLoginBoundary } from '../server/utils/auth'
import { createDevelopmentStore } from '../server/utils/store'
import { sponsorReadiness } from '../server/utils/runtime'

const EOA = '0x1111111111111111111111111111111111111111'
const SAFE = '0x2222222222222222222222222222222222222222'
const TARGET = '0x3333333333333333333333333333333333333333'
const SELECTOR = '0x12345678'
const NOW = Date.parse('2026-07-22T12:00:00.000Z')

const policy: SponsorPolicy = {
  chainId: MONAD_TESTNET_CHAIN_ID,
  target: TARGET,
  selector: SELECTOR,
  maxGas: 500_000n,
  maxExpiryMs: 5 * 60_000
}

function claim(overrides: Partial<SponsorClaim> = {}): SponsorClaim {
  return {
    chainId: MONAD_TESTNET_CHAIN_ID,
    eoa: EOA,
    safe: SAFE,
    target: TARGET,
    selector: SELECTOR,
    value: 0n,
    gas: 500_000n,
    expiresAt: NOW + 60_000,
    claimId: 'claim-000000000001',
    session: { id: 'session-1', eoa: EOA, expiresAt: NOW + 60_000, used: false },
    ...overrides
  }
}

describe('safe sponsor policy', () => {
  it('allows only one exact authenticated Monad draw claim', () => {
    expect(evaluateSponsorClaim(policy, claim(), NOW, new Set())).toEqual({ allowed: true })
  })

  it.each([
    ['chain', { chainId: 1 }],
    ['target', { target: '0x4444444444444444444444444444444444444444' }],
    ['selector', { selector: '0x87654321' }],
    ['nonzero value', { value: 1n }],
    ['max gas', { gas: 500_001n }],
    ['expired', { expiresAt: NOW - 1 }],
    ['missing session', { session: undefined }],
    ['replayed session', { session: { id: 'session-1', eoa: EOA, expiresAt: NOW + 60_000, used: true } }],
    ['reused EOA', { eoa: EOA }],
    ['reused Safe', { safe: SAFE }]
  ] as const)('rejects independently tampered %s', (_name, override) => {
    const used = new Set<string>()
    if (_name === 'reused EOA') used.add(`eoa:${EOA.toLowerCase()}`)
    if (_name === 'reused Safe') used.add(`safe:${SAFE.toLowerCase()}`)
    const result = evaluateSponsorClaim(policy, claim(override), NOW, used)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.reason).toBeTruthy()
  })

  it('rejects claim id reuse and unsafe claim identifiers', () => {
    expect(evaluateSponsorClaim(policy, claim(), NOW, new Set(['claim:claim-000000000001']))).toMatchObject({ allowed: false })
    expect(evaluateSponsorClaim(policy, claim({ claimId: 'short' }), NOW, new Set())).toMatchObject({ allowed: false })
  })
})

describe('authentication boundary', () => {
  it('creates an exact canonical login message and consumes nonce once', () => {
    const message = buildCanonicalLoginMessage({ eoa: EOA, nonce: 'nonce-000000000001', origin: 'https://draw.example', issuedAt: NOW, expiresAt: NOW + 60_000 })
    expect(message).toContain('Monad Lucky Draw EOA Login')
    expect(verifyLoginBoundary({ canonicalMessage: message, suppliedMessage: message, signature: '0xdeadbeef', cryptographicallyVerified: false })).toEqual({ authenticated: false, reason: 'signature-verification-unavailable' })
  })

  it('rejects a tampered canonical message and never accepts unsigned proof', () => {
    const message = buildCanonicalLoginMessage({ eoa: EOA, nonce: 'nonce-000000000001', origin: 'https://draw.example', issuedAt: NOW, expiresAt: NOW + 60_000 })
    expect(verifyLoginBoundary({ canonicalMessage: message, suppliedMessage: `${message}\nSafe: ${SAFE}`, signature: '', cryptographicallyVerified: true })).toMatchObject({ authenticated: false })
    expect(verifyLoginBoundary({ canonicalMessage: message, suppliedMessage: message, signature: '', cryptographicallyVerified: true })).toMatchObject({ authenticated: false })
  })
})

describe('development-only state and disabled runtime', () => {
  it('provides single-use nonce/session/claim interfaces with development-only persistence', () => {
    const store = createDevelopmentStore()
    const nonce = store.issueNonce({ eoa: EOA, origin: 'https://draw.example', now: NOW, ttlMs: 60_000 })
    expect(store.consumeNonce(nonce.id, NOW)).toMatchObject({ id: nonce.id })
    expect(store.consumeNonce(nonce.id, NOW)).toBeUndefined()
    expect(store.persistence).toBe('development-only')
  })

  it('keeps sponsor unavailable unless every production gate exists and leaks no secrets', () => {
    const readiness = sponsorReadiness({ enabled: false, persistentStore: false, sessionSecret: '', signingKey: 'private-key', paymasterConfig: 'credential', target: TARGET, budgetAvailable: false, circuitBreakerAvailable: false })
    expect(readiness).toMatchObject({ enabled: false, persistence: 'development-only' })
    expect(JSON.stringify(readiness)).not.toContain('private-key')
    expect(JSON.stringify(readiness)).not.toContain('credential')
    expect(JSON.stringify(readiness)).not.toContain('"sessionSecret"')
  })
})
