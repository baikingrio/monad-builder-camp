/**
 * Zodiac Roles session readiness for Monad Testnet.
 * Fail-closed: product stays on legacy owner Session Key until these gates flip.
 * Safe7579 path is archived; this module is the on-chain constraint successor.
 */

export const ROLES_LEGACY_SAFE = '0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276' as const

/**
 * Canonical multi-chain Roles / Zodiac addresses (not listed for Monad).
 * Probed via eth_getCode; expected empty until an authorized DeployRolesStack.
 */
export const ROLES_CANONICAL_UPSTREAM = Object.freeze({
  rolesMasterCopy: '0x9646fDAD06d3e24444381f44362a3B0eB343D337',
  moduleProxyFactory: '0x000000000000aDdB49795b0f9bA5BC298cDda236',
  integrity: '0x6a6Af4b16458Bc39817e4019fB02BD3b26d41049',
  packer: '0x61C5B1bE435391fDd7BC6703F3740C0d11728a8C'
})

export type RolesSessionMode = 'legacy-owner-session' | 'zodiac-roles-session'

export interface RolesStackStatus {
  readonly rolesMasterCopyPresent: boolean
  readonly moduleProxyFactoryPresent: boolean
  readonly deploymentPermitted: boolean
  readonly rolesSessionEnabled: boolean
  readonly onchainRolesProofPresent: boolean
}

export interface RolesReadiness {
  readonly mode: RolesSessionMode
  readonly enabled: boolean
  readonly blockers: readonly string[]
  readonly legacySafe: typeof ROLES_LEGACY_SAFE
  readonly canonicalUpstream: typeof ROLES_CANONICAL_UPSTREAM
  /** Safe7579 product path is archived; kept for UI cross-reference only. */
  readonly safe7579Superseded: true
}

/** Evaluate whether the app may expose the Zodiac Roles session product path. */
export function evaluateRolesReadiness(status: RolesStackStatus): RolesReadiness {
  const blockers: string[] = []
  if (!status.rolesMasterCopyPresent) blockers.push('roles-mastercopy-absent')
  if (!status.moduleProxyFactoryPresent) blockers.push('module-proxy-factory-absent')
  if (!status.deploymentPermitted) blockers.push('manifest-deployment-not-permitted')
  if (!status.rolesSessionEnabled) blockers.push('roles-session-feature-disabled')
  if (!status.onchainRolesProofPresent) blockers.push('onchain-roles-proof-missing')

  const enabled = blockers.length === 0
  return Object.freeze({
    mode: enabled ? 'zodiac-roles-session' : 'legacy-owner-session',
    enabled,
    blockers: Object.freeze([...blockers]),
    legacySafe: ROLES_LEGACY_SAFE,
    canonicalUpstream: ROLES_CANONICAL_UPSTREAM,
    safe7579Superseded: true as const
  })
}

/** Default fail-closed status until live verification and explicit config flip each gate. */
export function defaultRolesStackStatus(): RolesStackStatus {
  return Object.freeze({
    rolesMasterCopyPresent: false,
    moduleProxyFactoryPresent: false,
    deploymentPermitted: false,
    rolesSessionEnabled: false,
    onchainRolesProofPresent: false
  })
}
