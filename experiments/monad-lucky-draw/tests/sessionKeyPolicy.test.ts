import { describe, expect, it } from 'vitest'
import {
  createSessionKeyGrantDraft,
  evaluateSessionKeyDraw,
  SESSION_KEY_MAX_CALLS,
  type SessionKeyGrant
} from '../app/lib/sessionKeyPolicy'
import { MONAD_ACTIVATION_CONFIG } from '../app/lib/monadConfig'
import { LUCKY_DRAW_DRAW_SELECTOR } from '../app/lib/userOperationSimulation'

const NOW = Date.parse('2026-07-22T12:00:00.000Z')
const grant = (overrides: Partial<SessionKeyGrant> = {}): SessionKeyGrant => ({
  eoa: '0x7c0343c808b827e4286381c2292d92c3f19152a4',
  safe: '0xb127994eed5f0aa8a42a446e796a2fcc0d1bb276',
  sessionAddress: '0x1111111111111111111111111111111111111111',
  expiresAt: NOW + 60_000,
  remainingCalls: SESSION_KEY_MAX_CALLS,
  onchainAuthorized: true,
  ...overrides
})

describe('session key draw policy', () => {
  it('allows only the LuckyDraw draw selector with value zero after onchain authorization', () => {
    expect(evaluateSessionKeyDraw({
      grant: grant(),
      target: MONAD_ACTIVATION_CONFIG.luckyDraw,
      selector: LUCKY_DRAW_DRAW_SELECTOR,
      value: 0n,
      now: NOW
    })).toEqual({ allowed: true })
  })

  it.each([
    ['other target', { target: '0x2222222222222222222222222222222222222222' }],
    ['arbitrary calldata', { selector: '0xdeadbeef' }],
    ['nonzero value', { value: 1n }],
    ['expired', { grant: grant({ expiresAt: NOW - 1 }) }],
    ['exhausted', { grant: grant({ remainingCalls: 0 }) }],
    ['not onchain authorized', { grant: grant({ onchainAuthorized: false }) }]
  ])('rejects %s', (_name, override) => {
    const result = evaluateSessionKeyDraw({
      grant: grant(),
      target: MONAD_ACTIVATION_CONFIG.luckyDraw,
      selector: LUCKY_DRAW_DRAW_SELECTOR,
      value: 0n,
      now: NOW,
      ...override
    } as never)
    expect(result.allowed).toBe(false)
  })

  it('does not store sponsor credentials in a grant draft', () => {
    const draft = createSessionKeyGrantDraft({
      eoa: grant().eoa,
      safe: grant().safe,
      sessionAddress: grant().sessionAddress,
      now: NOW
    })
    expect(draft.onchainAuthorized).toBe(false)
    expect(JSON.stringify(draft)).not.toMatch(/pimlico|apikey|private|secret/i)
  })
})
