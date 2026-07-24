import { describe, expect, it } from 'vitest'
import {
  SAFE7579_KNOWN_ABSENT,
  SAFE7579_LEGACY_SAFE,
  defaultSafe7579StackStatus,
  evaluateSafe7579Readiness
} from '../app/lib/safe7579Readiness'

describe('safe7579Readiness', () => {
  it('stays on legacy-owner-session while Monad stack and audit gates are closed', () => {
    const readiness = evaluateSafe7579Readiness(defaultSafe7579StackStatus())
    expect(readiness.enabled).toBe(false)
    expect(readiness.mode).toBe('legacy-owner-session')
    expect(readiness.legacySafe).toBe(SAFE7579_LEGACY_SAFE)
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      'safe7579-launchpad-absent',
      'smart-session-emissary-absent',
      'custom-policies-not-audited',
      'manifest-deployment-not-permitted',
      'onchain-policy-receipt-missing'
    ]))
    expect(JSON.stringify(readiness)).not.toMatch(/pimlico|apikey|private|secret/i)
  })

  it('only enables safe7579-smart-session when every gate is true', () => {
    const readiness = evaluateSafe7579Readiness({
      launchpadCodePresent: true,
      adapterCodePresent: true,
      smartSessionCodePresent: true,
      customPoliciesAudited: true,
      deploymentPermitted: true,
      onchainPolicyReceiptPresent: true
    })
    expect(readiness).toMatchObject({ enabled: true, mode: 'safe7579-smart-session', blockers: [] })
    expect(readiness.knownAbsent.launchpad).toBe(SAFE7579_KNOWN_ABSENT.launchpad)
  })
})
