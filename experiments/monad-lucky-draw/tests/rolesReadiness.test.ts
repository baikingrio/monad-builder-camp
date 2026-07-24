import { describe, expect, it } from 'vitest'
import {
  ROLES_CANONICAL_UPSTREAM,
  ROLES_LEGACY_SAFE,
  defaultRolesStackStatus,
  evaluateRolesReadiness
} from '../app/lib/rolesReadiness'

describe('rolesReadiness', () => {
  it('stays on legacy-owner-session while Monad Roles stack and feature gates are closed', () => {
    const readiness = evaluateRolesReadiness(defaultRolesStackStatus())
    expect(readiness.enabled).toBe(false)
    expect(readiness.mode).toBe('legacy-owner-session')
    expect(readiness.legacySafe).toBe(ROLES_LEGACY_SAFE)
    expect(readiness.safe7579Superseded).toBe(true)
    expect(readiness.blockers).toEqual([
      'roles-mastercopy-absent',
      'module-proxy-factory-absent',
      'manifest-deployment-not-permitted',
      'roles-session-feature-disabled',
      'onchain-roles-proof-missing'
    ])
  })

  it('only enables zodiac-roles-session when every gate is true', () => {
    const readiness = evaluateRolesReadiness({
      rolesMasterCopyPresent: true,
      moduleProxyFactoryPresent: true,
      deploymentPermitted: true,
      rolesSessionEnabled: true,
      onchainRolesProofPresent: true
    })
    expect(readiness).toMatchObject({ enabled: true, mode: 'zodiac-roles-session', blockers: [] })
    expect(readiness.canonicalUpstream.rolesMasterCopy).toBe(ROLES_CANONICAL_UPSTREAM.rolesMasterCopy)
  })
})
