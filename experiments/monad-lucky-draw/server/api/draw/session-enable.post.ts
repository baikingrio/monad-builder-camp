import { createPublicClient, defineChain, http, type Address } from 'viem'
import { deriveMonadCounterfactualSafe } from '../../../app/lib/safeAddress'
import { MONAD_ACTIVATION_CONFIG } from '../../../app/lib/monadConfig'
import { prepareSessionEnableUserOperation } from '../../utils/sessionExecution'
import { sanitizeActivationError } from '../../utils/sanitizeActivationError'
import { upsertPendingSessionGrant } from '../../utils/sessionKeyStore'
import { SESSION_KEY_GAS_TIP_WEI } from '../../../app/lib/rolesPermissions'
import { buildRemoveExtraOwnersCalls } from '../../utils/rolesSessionEnable'
import { resolveSponsorGates } from '../../utils/sponsorGates'
import { persistentStore } from '../../utils/sqliteStore'

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
})

const SAFE_OWNERS_ABI = [{
  type: 'function',
  name: 'getOwners',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ type: 'address[]' }]
}] as const

export default defineEventHandler(async (event) => {
  const now = Date.now()
  const config = useRuntimeConfig()
  const gates = resolveSponsorGates(config)
  if (!gates.readiness.enabled || !gates.live) {
    setResponseStatus(event, 503)
    return { ok: false, reason: 'sponsor-disabled' }
  }

  const body = await readBody<{ safe?: string; sessionAddress?: string; userClicked?: boolean }>(event)
  const sessionId = getCookie(event, 'lucky_draw_session')
  const session = typeof sessionId === 'string' ? persistentStore.readSession(sessionId, now) : undefined
  if (!session) {
    setResponseStatus(event, 401)
    return { ok: false, reason: 'unauthenticated-session' }
  }
  if (body?.userClicked !== true) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'explicit-click-required' }
  }
  const expectedSafe = deriveMonadCounterfactualSafe({ owner: session.eoa, config: MONAD_ACTIVATION_CONFIG, saltNonce: 0n }).address
  const safe = typeof body?.safe === 'string' ? body.safe : ''
  const sessionAddress = typeof body?.sessionAddress === 'string' ? body.sessionAddress : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(safe) || !/^0x[a-fA-F0-9]{40}$/.test(sessionAddress)) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'invalid-addresses' }
  }
  if (safe.toLowerCase() !== expectedSafe.toLowerCase()) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'safe-mismatch' }
  }

  try {
    const rolesMode = MONAD_ACTIVATION_CONFIG.rolesSessionEnabled === true
    let removeOwners: ReturnType<typeof buildRemoveExtraOwnersCalls> | undefined
    if (rolesMode) {
      const client = createPublicClient({
        chain: monadTestnet,
        transport: http(String(config.public.monadRpcUrl || 'https://testnet-rpc.monad.xyz'))
      })
      const owners = await client.readContract({
        address: safe as Address,
        abi: SAFE_OWNERS_ABI,
        functionName: 'getOwners'
      })
      removeOwners = buildRemoveExtraOwnersCalls({
        owners: owners as Address[],
        keepOwner: session.eoa as Address
      })
      const nativeBalance = await client.getBalance({ address: safe as Address })
      if (nativeBalance < SESSION_KEY_GAS_TIP_WEI) {
        setResponseStatus(event, 400)
        return {
          ok: false,
          reason: 'safe-native-balance-insufficient-for-session-tip',
          neededWei: SESSION_KEY_GAS_TIP_WEI.toString(),
          balanceWei: nativeBalance.toString()
        }
      }
    }

    const prepared = await prepareSessionEnableUserOperation({
      live: gates.live,
      owner: session.eoa as Address,
      safe: safe as Address,
      sessionAddress: sessionAddress as Address,
      removeOwners
    })

    const rolesModifier = 'rolesModifier' in prepared ? prepared.rolesModifier : undefined
    const grant = upsertPendingSessionGrant({
      eoa: session.eoa,
      safe,
      sessionAddress,
      now,
      mode: rolesMode ? 'roles' : 'legacy',
      rolesModifier
    })

    persistentStore.recordAudit({ event: 'session-enable-prepared', eoa: session.eoa, now, outcome: 'accepted' })
    return {
      ok: true,
      mode: prepared.mode,
      rolesModifier,
      grant: {
        expiresAt: grant.expiresAt,
        remainingCalls: grant.remainingCalls,
        sessionAddress: grant.sessionAddress,
        mode: grant.mode,
        rolesModifier: grant.rolesModifier
      },
      entryPoint: prepared.entryPoint,
      userOperation: prepared.userOperation
    }
  } catch (error) {
    persistentStore.recordAudit({ event: 'session-enable-failed', eoa: session.eoa, now, outcome: 'rejected' })
    setResponseStatus(event, 400)
    return { ok: false, reason: sanitizeActivationError(error) }
  }
})
