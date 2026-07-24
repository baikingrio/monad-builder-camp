/**
 * Safe7579 / Smart Session readiness for Monad Testnet.
 * ARCHIVED: product path superseded by Zodiac Roles (`rolesReadiness.ts`).
 * Fail-closed API retained for read-only cross-checks.
 */

export const SAFE7579_LEGACY_SAFE = '0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276' as const

/** Deterministic addresses that currently have empty bytecode on Monad Testnet. */
export const SAFE7579_KNOWN_ABSENT = Object.freeze({
  launchpad: '0x75798463024bda64d83c94a64bc7d7eab41300ef',
  adapter: '0x7579f2ad53b01c3d8779fe17928e0d48885b0003',
  smartSessionEmissary: '0xad568b3f825a8d5ffc06dd3253526b64d810ae89',
  uniActionPolicy: '0x0000006dda6c463511c4e9b05cfc34c1247fcf1f',
  timeFramePolicy: '0x8177451511de0577b911c254e9551d981c26dc72',
  valueLimitPolicy: '0xa09b47de6e510cbdc18b97e9239bedcb44fb4901'
})

export type Safe7579Mode = 'legacy-owner-session' | 'safe7579-smart-session'

export interface Safe7579StackStatus {
  readonly launchpadCodePresent: boolean
  readonly adapterCodePresent: boolean
  readonly smartSessionCodePresent: boolean
  readonly customPoliciesAudited: boolean
  readonly deploymentPermitted: boolean
  readonly onchainPolicyReceiptPresent: boolean
}

export interface Safe7579Readiness {
  readonly mode: Safe7579Mode
  readonly enabled: boolean
  readonly blockers: readonly string[]
  readonly legacySafe: typeof SAFE7579_LEGACY_SAFE
  readonly knownAbsent: typeof SAFE7579_KNOWN_ABSENT
}

/** Evaluate whether the app may expose the 7579 Smart Session product path. */
export function evaluateSafe7579Readiness(status: Safe7579StackStatus): Safe7579Readiness {
  const blockers: string[] = []
  if (!status.launchpadCodePresent) blockers.push('safe7579-launchpad-absent')
  if (!status.adapterCodePresent) blockers.push('safe7579-adapter-absent')
  if (!status.smartSessionCodePresent) blockers.push('smart-session-emissary-absent')
  if (!status.customPoliciesAudited) blockers.push('custom-policies-not-audited')
  if (!status.deploymentPermitted) blockers.push('manifest-deployment-not-permitted')
  if (!status.onchainPolicyReceiptPresent) blockers.push('onchain-policy-receipt-missing')

  const enabled = blockers.length === 0
  return Object.freeze({
    mode: enabled ? 'safe7579-smart-session' : 'legacy-owner-session',
    enabled,
    blockers: Object.freeze([...blockers]),
    legacySafe: SAFE7579_LEGACY_SAFE,
    knownAbsent: SAFE7579_KNOWN_ABSENT
  })
}

/** Default fail-closed status used by the app until live verification flips each gate. */
export function defaultSafe7579StackStatus(): Safe7579StackStatus {
  return Object.freeze({
    launchpadCodePresent: false,
    adapterCodePresent: false,
    smartSessionCodePresent: false,
    customPoliciesAudited: false,
    deploymentPermitted: false,
    onchainPolicyReceiptPresent: false
  })
}
