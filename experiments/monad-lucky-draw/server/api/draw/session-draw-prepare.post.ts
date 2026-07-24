import { deriveMonadCounterfactualSafe } from '../../../app/lib/safeAddress'
import { MONAD_ACTIVATION_CONFIG } from '../../../app/lib/monadConfig'
import { sanitizeActivationError } from '../../utils/sanitizeActivationError'
import { readActiveSessionGrant } from '../../utils/sessionKeyStore'
import { prepareRolesSessionDraw } from '../../utils/rolesSessionDraw'
import { persistentStore } from '../../utils/sqliteStore'

/**
 * Prepare a Roles-mode session draw: returns an EOA tx for Session Key → Roles.execTransactionWithRole.
 * Does not create a Safe4337 UserOperation.
 */
export default defineEventHandler(async (event) => {
  const now = Date.now()
  if (MONAD_ACTIVATION_CONFIG.rolesSessionEnabled !== true) {
    setResponseStatus(event, 503)
    return { ok: false, reason: 'roles-session-feature-disabled' }
  }

  const body = await readBody<{ safe?: string; userClicked?: boolean }>(event)
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
  const safe = typeof body?.safe === 'string' ? body.safe : expectedSafe
  if (safe.toLowerCase() !== expectedSafe.toLowerCase()) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'safe-mismatch' }
  }

  const grant = readActiveSessionGrant({ eoa: session.eoa, safe: expectedSafe, now })
  if (!grant) {
    setResponseStatus(event, 409)
    return { ok: false, reason: 'session-grant-unavailable' }
  }
  if (grant.mode !== 'roles') {
    setResponseStatus(event, 409)
    return {
      ok: false,
      reason: 'legacy-grant-requires-roles-reenable',
      hint: 'Active session grant is still legacy-owner-session. Click enable again to install Roles and replace the grant.'
    }
  }

  try {
    const config = useRuntimeConfig()
    const prepared = await prepareRolesSessionDraw({
      grant,
      now,
      rpcUrl: String(config.public.monadRpcUrl || 'https://testnet-rpc.monad.xyz')
    })
    const preparation = persistentStore.saveSessionDrawPreparation({
      eoa: session.eoa,
      safe: expectedSafe,
      sessionAddress: grant.sessionAddress,
      userOperation: {},
      expiresAt: Math.min(grant.expiresAt, now + 60_000),
      now,
      rolesTransaction: {
        to: prepared.to,
        value: prepared.value.toString(),
        data: prepared.data,
        rolesModifier: prepared.rolesModifier
      }
    })
    persistentStore.recordAudit({ event: 'roles-session-draw-prepared', eoa: session.eoa, now, outcome: 'accepted' })
    return {
      ok: true,
      mode: 'roles',
      preparationId: preparation.id,
      sessionAddress: prepared.sessionAddress,
      remainingCalls: prepared.remainingCalls,
      expiresAt: preparation.expiresAt,
      sessionBalanceWei: prepared.sessionBalanceWei,
      estimatedGasTipFloorWei: prepared.estimatedGasTipFloorWei,
      transaction: {
        to: prepared.to,
        value: prepared.value.toString(),
        data: prepared.data
      }
    }
  } catch (error) {
    persistentStore.recordAudit({ event: 'roles-session-draw-prepare-failed', eoa: session.eoa, now, outcome: 'rejected' })
    setResponseStatus(event, 400)
    return { ok: false, reason: sanitizeActivationError(error) }
  }
})
