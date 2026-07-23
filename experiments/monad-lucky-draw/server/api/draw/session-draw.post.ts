import { deriveMonadCounterfactualSafe } from '../../../app/lib/safeAddress'
import { MONAD_ACTIVATION_CONFIG } from '../../../app/lib/monadConfig'
import type { Address } from 'viem'
import { prepareSessionDrawUserOperation } from '../../utils/sessionExecution'
import { sanitizeActivationError } from '../../utils/sanitizeActivationError'
import { readActiveSessionGrant } from '../../utils/sessionKeyStore'
import { resolveUserFundedExecution } from '../../utils/sponsorGates'
import { persistentStore } from '../../utils/sqliteStore'

export default defineEventHandler(async (event) => {
  const now = Date.now()
  const config = useRuntimeConfig()
  const live = resolveUserFundedExecution(config)
  if (!live) {
    setResponseStatus(event, 503)
    return { ok: false, reason: 'user-funded-bundler-unavailable' }
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

  try {
    const prepared = await prepareSessionDrawUserOperation({ live, grant, now })
    const preparation = persistentStore.saveSessionDrawPreparation({
      eoa: session.eoa, safe: expectedSafe, sessionAddress: grant.sessionAddress,
      userOperation: prepared.userOperation, expiresAt: Math.min(grant.expiresAt, now + 60_000), now
    })
    persistentStore.recordAudit({ event: 'session-draw-prepared', eoa: session.eoa, now, outcome: 'accepted' })
    return {
      ok: true,
      sessionAddress: grant.sessionAddress as Address,
      remainingCalls: grant.remainingCalls,
      expiresAt: preparation.expiresAt,
      preparationId: preparation.id,
      entryPoint: prepared.entryPoint,
      userOperation: prepared.userOperation
    }
  } catch (error) {
    persistentStore.recordAudit({ event: 'session-draw-prepare-failed', eoa: session.eoa, now, outcome: 'rejected' })
    setResponseStatus(event, 400)
    return { ok: false, reason: sanitizeActivationError(error) }
  }
})
