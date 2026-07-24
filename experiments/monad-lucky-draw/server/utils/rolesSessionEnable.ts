import type { Address, Hex } from 'viem'
import { MONAD_ACTIVATION_CONFIG } from '../../app/lib/monadConfig'
import {
  ROLES_PROXY_SALT_NONCE,
  SESSION_KEY_GAS_TIP_WEI,
  encodeAssignDrawRole,
  encodeDeployRolesModule,
  encodeEnableModule,
  encodeRemoveOwner,
  encodeScopeDrawOnly,
  predictRolesProxyAddress
} from '../../app/lib/rolesPermissions'

export type SafeCall = { readonly to: Address; readonly value: bigint; readonly data: Hex }

const SENTINEL_OWNERS = '0x0000000000000000000000000000000000000001' as Address

/**
 * Owner UserOp calls for Zodiac Roles session enable (no addOwner).
 * Deploys Roles proxy (CREATE2), enableModule, scope draw-only, assignRoles, tip session key.
 * Optionally removes extra Safe owners so Session Key is not an owner.
 * Already-deployed / already-enabled Safes should set skip* flags to avoid TakenAddress / GS200.
 */
export function buildRolesSessionEnableCalls(input: {
  readonly safe: Address
  readonly sessionAddress: Address
  readonly rolesModifier?: Address
  readonly deploy?: {
    readonly factory: Address
    readonly masterCopy: Address
    readonly saltNonce: bigint
  }
  readonly tipWei?: bigint
  /** Owners to remove (prevOwner, owner). Threshold stays 1. */
  readonly removeOwners?: readonly { readonly prevOwner: Address; readonly owner: Address }[]
  /** Skip ModuleProxyFactory.deployModule when CREATE2 proxy already has code. */
  readonly skipDeploy?: boolean
  /** Skip Safe.enableModule when Roles is already enabled. */
  readonly skipEnableModule?: boolean
  /** Skip scopeTarget/allowFunction when permissions were already configured. */
  readonly skipPermissions?: boolean
}): { readonly calls: readonly SafeCall[]; readonly rolesModifier: Address } {
  const tip = input.tipWei ?? SESSION_KEY_GAS_TIP_WEI
  const saltNonce = input.deploy?.saltNonce ?? ROLES_PROXY_SALT_NONCE
  const rolesModifier = input.rolesModifier ?? predictRolesProxyAddress({
    safe: input.safe,
    factory: input.deploy?.factory,
    masterCopy: input.deploy?.masterCopy,
    saltNonce
  })
  const scoped = encodeScopeDrawOnly()
  const calls: SafeCall[] = []

  if (!input.skipDeploy) {
    const factory = (input.deploy?.factory ?? MONAD_ACTIVATION_CONFIG.rolesModuleProxyFactory) as Address
    const masterCopy = (input.deploy?.masterCopy ?? MONAD_ACTIVATION_CONFIG.rolesMasterCopy) as Address
    calls.push({
      to: factory,
      value: 0n,
      data: encodeDeployRolesModule({
        masterCopy,
        owner: input.safe,
        saltNonce
      })
    })
  }

  for (const entry of input.removeOwners ?? []) {
    calls.push({
      to: input.safe,
      value: 0n,
      data: encodeRemoveOwner({ prevOwner: entry.prevOwner, owner: entry.owner, threshold: 1n })
    })
  }

  if (!input.skipEnableModule) {
    calls.push({ to: input.safe, value: 0n, data: encodeEnableModule(rolesModifier) })
  }
  if (!input.skipPermissions) {
    calls.push(
      { to: rolesModifier, value: 0n, data: scoped.scopeTarget },
      { to: rolesModifier, value: 0n, data: scoped.allowFunction }
    )
  }
  calls.push(
    { to: rolesModifier, value: 0n, data: encodeAssignDrawRole(input.sessionAddress) },
    { to: input.sessionAddress, value: tip, data: '0x' }
  )

  return { calls: Object.freeze(calls), rolesModifier }
}

/** Build prev→owner remove pairs for every owner except the primary EOA. */
export function buildRemoveExtraOwnersCalls(input: {
  readonly owners: readonly Address[]
  readonly keepOwner: Address
}): readonly { readonly prevOwner: Address; readonly owner: Address }[] {
  const keep = input.keepOwner.toLowerCase()
  const owners = [...input.owners]
  const removals: { prevOwner: Address; owner: Address }[] = []
  // Walk from head; each removal uses current prev in the remaining list.
  let prev: Address = SENTINEL_OWNERS
  for (const owner of owners) {
    if (owner.toLowerCase() === keep) {
      prev = owner
      continue
    }
    removals.push({ prevOwner: prev, owner })
    // prev stays the same after removal (next links to prev)
  }
  return Object.freeze(removals)
}

/** Throws unless feature flag is on. */
export function assertRolesSessionEnableAllowed(): void {
  if (MONAD_ACTIVATION_CONFIG.rolesSessionEnabled !== true) {
    throw new Error('roles-session-feature-disabled')
  }
}

export { SENTINEL_OWNERS, predictRolesProxyAddress }
