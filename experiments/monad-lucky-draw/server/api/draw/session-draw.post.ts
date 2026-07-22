import type { Address } from 'viem'
import { prepareSessionDrawUserOperation } from '../../utils/sessionExecution'
import { sanitizeActivationError } from '../../utils/sanitizeActivationError'
import { readActiveSessionGrant } from '../../utils/sessionKeyStore'
import { resolveSponsorGates } from '../../utils/sponsorGates'
import { persistentStore } from '../../utils/sqliteStore'

export default defineEventHandler(async (event) => {
  const now = Date.now()
  const config = useRuntimeConfig()
  const gates = resolveSponsorGates(config)
  if (!gates.readiness.enabled || !gates.live) {
    setResponseStatus(event, 503)
    return { ok: false, reason: 'sponsor-disabled' }
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
  const safe = typeof body?.safe === 'string' ? body.safe : ''
  const grant = readActiveSessionGrant({ eoa: session.eoa, safe, now })
  if (!grant) {
    setResponseStatus(event, 409)
    return { ok: false, reason: 'session-grant-unavailable' }
  }

  try {
    const prepared = await prepareSessionDrawUserOperation({ live: gates.live, grant, now })
    persistentStore.recordAudit({ event: 'session-draw-prepared', eoa: session.eoa, now, outcome: 'accepted' })
    return {
      ok: true,
      sessionAddress: grant.sessionAddress as Address,
      remainingCalls: grant.remainingCalls,
      expiresAt: grant.expiresAt,
      entryPoint: prepared.entryPoint,
      userOperation: prepared.userOperation
    }
  } catch (error) {
    persistentStore.recordAudit({ event: 'session-draw-prepare-failed', eoa: session.eoa, now, outcome: 'rejected' })
    setResponseStatus(event, 400)
    return { ok: false, reason: sanitizeActivationError(error) }
  }
})
