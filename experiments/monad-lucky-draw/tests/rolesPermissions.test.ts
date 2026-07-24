import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import {
  LUCKY_DRAW_ROLE_KEY,
  SESSION_KEY_GAS_TIP_WEI,
  assertRolesDrawTransaction,
  buildRolesDrawTransaction,
  encodeAssignDrawRole,
  encodeExecDrawWithRole,
  encodeScopeDrawOnly,
  predictRolesProxyAddress
} from '../app/lib/rolesPermissions'
import { buildRemoveExtraOwnersCalls, buildRolesSessionEnableCalls } from '../server/utils/rolesSessionEnable'
import { MONAD_ACTIVATION_CONFIG } from '../app/lib/monadConfig'

describe('rolesPermissions', () => {
  it('pins LUCKY_DRAW role key and zero-value draw calldata', () => {
    expect(LUCKY_DRAW_ROLE_KEY).toMatch(/^0x[a-f0-9]{64}$/)
    const data = encodeExecDrawWithRole()
    expect(data.startsWith('0x')).toBe(true)
    expect(SESSION_KEY_GAS_TIP_WEI).toBe(100_000_000_000_000_000n)
  })

  it('builds Roles draw tx targeting the modifier only', () => {
    const rolesModifier = '0x1111111111111111111111111111111111111111' as Address
    const tx = buildRolesDrawTransaction({ rolesModifier })
    expect(tx.to).toBe(rolesModifier)
    expect(tx.value).toBe(0n)
    assertRolesDrawTransaction({ ...tx, rolesModifier })
    expect(() => assertRolesDrawTransaction({
      to: MONAD_ACTIVATION_CONFIG.luckyDraw as Address,
      value: 0n,
      data: tx.data,
      rolesModifier
    })).toThrow(/must target the Roles modifier/)
  })

  it('encodes scopeTarget + allowFunction for draw-only', () => {
    const scoped = encodeScopeDrawOnly()
    expect(scoped.scopeTarget.startsWith('0x')).toBe(true)
    expect(scoped.allowFunction.startsWith('0x')).toBe(true)
    expect(encodeAssignDrawRole('0x2222222222222222222222222222222222222222').startsWith('0x')).toBe(true)
  })

  it('predicts a deterministic Roles proxy per Safe', () => {
    const safe = '0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276' as Address
    const a = predictRolesProxyAddress({ safe })
    const b = predictRolesProxyAddress({ safe })
    expect(a).toBe(b)
    expect(a).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(a.toLowerCase()).not.toBe(safe.toLowerCase())
  })
})

describe('rolesSessionEnable', () => {
  it('builds MultiSend calls without addOwner and with session tip', () => {
    const safe = '0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276' as Address
    const session = '0x3333333333333333333333333333333333333333' as Address
    const { calls, rolesModifier } = buildRolesSessionEnableCalls({
      safe,
      sessionAddress: session,
      deploy: {
        factory: MONAD_ACTIVATION_CONFIG.rolesModuleProxyFactory as Address,
        masterCopy: MONAD_ACTIVATION_CONFIG.rolesMasterCopy as Address,
        saltNonce: 0n
      }
    })
    expect(rolesModifier).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(calls.length).toBeGreaterThanOrEqual(6)
    expect(calls[0]?.to.toLowerCase()).toBe(MONAD_ACTIVATION_CONFIG.rolesModuleProxyFactory.toLowerCase())
    expect(calls[calls.length - 1]?.to.toLowerCase()).toBe(session.toLowerCase())
    expect(calls[calls.length - 1]?.value).toBe(SESSION_KEY_GAS_TIP_WEI)
  })

  it('skips deploy/enable/permissions when Roles is already live', () => {
    const safe = '0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276' as Address
    const session = '0x3333333333333333333333333333333333333333' as Address
    const rolesModifier = '0xF6452e2423e0abEA5C1694408DC2B72A9e299De7' as Address
    const { calls } = buildRolesSessionEnableCalls({
      safe,
      sessionAddress: session,
      rolesModifier,
      skipDeploy: true,
      skipEnableModule: true,
      skipPermissions: true
    })
    expect(calls).toHaveLength(2)
    expect(calls[0]?.to.toLowerCase()).toBe(rolesModifier.toLowerCase())
    expect(calls[1]?.to.toLowerCase()).toBe(session.toLowerCase())
    expect(calls[1]?.value).toBe(SESSION_KEY_GAS_TIP_WEI)
  })

  it('builds removeOwner pairs keeping the primary EOA', () => {
    const keep = '0x7c0343c808B827e4286381c2292d92c3f19152a4' as Address
    const extra1 = '0x58Fad805fE86f9BAFBdde99a1f60C416162eE8C9' as Address
    const extra2 = '0x956603CaD411f50e49355b9830218276503e6a3d' as Address
    const removals = buildRemoveExtraOwnersCalls({
      owners: [extra1, extra2, keep],
      keepOwner: keep
    })
    expect(removals).toHaveLength(2)
    expect(removals[0]?.owner.toLowerCase()).toBe(extra1.toLowerCase())
    expect(removals[1]?.owner.toLowerCase()).toBe(extra2.toLowerCase())
  })
})
