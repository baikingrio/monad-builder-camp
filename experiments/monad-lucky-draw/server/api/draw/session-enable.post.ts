import type { Address } from 'viem'
import { prepareSessionEnableUserOperation } from '../../utils/sessionExecution'
import { sanitizeActivationError } from '../../utils/sanitizeActivationError'
import { upsertPendingSessionGrant } from '../../utils/sessionKeyStore'
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
  const safe = typeof body?.safe === 'string' ? body.safe : ''
  const sessionAddress = typeof body?.sessionAddress === 'string' ? body.sessionAddress : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(safe) || !/^0x[a-fA-F0-9]{40}$/.test(sessionAddress)) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'invalid-addresses' }
  }

  try {
    const grant = upsertPendingSessionGrant({
      eoa: session.eoa,
      safe,
      sessionAddress,
      now
    })
    const prepared = await prepareSessionEnableUserOperation({
      live: gates.live,
      owner: session.eoa as Address,
      safe: safe as Address,
      sessionAddress: sessionAddress as Address
    })
    persistentStore.recordAudit({ event: 'session-enable-prepared', eoa: session.eoa, now, outcome: 'accepted' })
    return {
      ok: true,
      grant: {
        expiresAt: grant.expiresAt,
        remainingCalls: grant.remainingCalls,
        sessionAddress: grant.sessionAddress
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
