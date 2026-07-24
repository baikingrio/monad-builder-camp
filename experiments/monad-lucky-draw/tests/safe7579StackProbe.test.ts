import { describe, expect, it } from 'vitest'
import { SAFE7579_KNOWN_ABSENT } from '../app/lib/safe7579Readiness'
import { getSafe7579ReadinessReport, probeSafe7579StackStatus } from '../server/utils/safe7579StackProbe'

describe('safe7579StackProbe', () => {
  it('marks launchpad/adapter/smartSession absent when eth_getCode is empty and keeps audit gates closed', async () => {
    const stack = await probeSafe7579StackStatus({
      readCode: async () => '0x',
      customPoliciesAudited: false,
      deploymentPermitted: false,
      onchainPolicyReceiptPresent: false
    })
    expect(stack).toEqual({
      launchpadCodePresent: false,
      adapterCodePresent: false,
      smartSessionCodePresent: false,
      customPoliciesAudited: false,
      deploymentPermitted: false,
      onchainPolicyReceiptPresent: false
    })
  })

  it('detects code presence but still fails closed without audit/manifest/receipt gates', async () => {
    const report = await getSafe7579ReadinessReport({
      readCode: async (address) => {
        if (address.toLowerCase() === SAFE7579_KNOWN_ABSENT.launchpad.toLowerCase()) return '0x60016000'
        if (address.toLowerCase() === SAFE7579_KNOWN_ABSENT.adapter.toLowerCase()) return '0x60016000'
        if (address.toLowerCase() === SAFE7579_KNOWN_ABSENT.smartSessionEmissary.toLowerCase()) return '0x60016000'
        return '0x'
      }
    })
    expect(report.stack.launchpadCodePresent).toBe(true)
    expect(report.stack.adapterCodePresent).toBe(true)
    expect(report.stack.smartSessionCodePresent).toBe(true)
    expect(report.enabled).toBe(false)
    expect(report.mode).toBe('legacy-owner-session')
    expect(report.blockers).toEqual(expect.arrayContaining([
      'custom-policies-not-audited',
      'manifest-deployment-not-permitted',
      'onchain-policy-receipt-missing'
    ]))
    expect(JSON.stringify(report)).not.toMatch(/pimlico|apikey|private|secret|https?:/i)
  })
})
