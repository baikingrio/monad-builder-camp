import { describe, expect, it } from 'vitest'
import { ROLES_CANONICAL_UPSTREAM } from '../app/lib/rolesReadiness'
import { getRolesReadinessReport, probeRolesStackStatus } from '../server/utils/rolesStackProbe'

describe('rolesStackProbe', () => {
  it('marks canonical upstream absent when eth_getCode is empty', async () => {
    const stack = await probeRolesStackStatus({
      readCode: async () => '0x'
    })
    expect(stack.rolesMasterCopyPresent).toBe(false)
    expect(stack.moduleProxyFactoryPresent).toBe(false)
    expect(stack.deploymentPermitted).toBe(false)
    expect(stack.rolesSessionEnabled).toBe(false)
  })

  it('enables zodiac-roles-session when stack, feature flag, and on-chain proof gates are open', async () => {
    const report = await getRolesReadinessReport({
      readCode: async (address) => {
        if (address.toLowerCase() === ROLES_CANONICAL_UPSTREAM.rolesMasterCopy.toLowerCase()) return '0x60016000'
        if (address.toLowerCase() === ROLES_CANONICAL_UPSTREAM.moduleProxyFactory.toLowerCase()) return '0x60016000'
        return '0x'
      }
    })
    expect(report.stack.rolesMasterCopyPresent).toBe(true)
    expect(report.stack.moduleProxyFactoryPresent).toBe(true)
    expect(report.stack.deploymentPermitted).toBe(true)
    expect(report.stack.rolesSessionEnabled).toBe(true)
    expect(report.stack.onchainRolesProofPresent).toBe(true)
    expect(report.enabled).toBe(true)
    expect(report.mode).toBe('zodiac-roles-session')
    expect(report.blockers).toEqual([])
    expect(report.safe7579Superseded).toBe(true)
  })
})
