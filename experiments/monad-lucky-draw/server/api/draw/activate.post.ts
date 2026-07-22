import { randomUUID } from 'node:crypto'
import { assertActivationDrawRequest, type ActivationSafeState } from '../../../app/lib/activationUserOperation'
import { prepareSponsoredActivation } from '../../utils/activationExecution'
import { sanitizeActivationError } from '../../utils/sanitizeActivationError'
import { resolveSponsorGates } from '../../utils/sponsorGates'
import { persistentStore } from '../../utils/sqliteStore'

export default defineEventHandler(async (event) => {
  const now = Date.now()
  const config = useRuntimeConfig()
  const gates = resolveSponsorGates(config)
  if (!gates.readiness.enabled || !gates.live) {
    setResponseStatus(event, 503)
    return { ok: false, reason: 'sponsor-disabled', missing: gates.readiness.missing }
  }

  const body = await readBody<{ safe?: ActivationSafeState; userClicked?: boolean }>(event)
  const sessionId = getCookie(event, 'lucky_draw_session')
  const session = typeof sessionId === 'string' ? persistentStore.readSession(sessionId, now) : undefined
  if (!session) {
    setResponseStatus(event, 401)
    return { ok: false, reason: 'unauthenticated-session' }
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!gates.rateLimit.allow({ ip, eoa: session.eoa, now })) {
    setResponseStatus(event, 429)
    persistentStore.recordAudit({ event: 'activate-rate-limited', eoa: session.eoa, now, outcome: 'rejected' })
    return { ok: false, reason: 'rate-limited' }
  }
  if (!gates.budget.available() || !gates.breaker.isClosed(now)) {
    setResponseStatus(event, 503)
    return { ok: false, reason: 'budget-or-breaker-unavailable' }
  }

  try {
    const validated = assertActivationDrawRequest({
      owner: session.eoa,
      safe: body?.safe as ActivationSafeState,
      userClicked: body?.userClicked === true
    })
    const claimId = `claim-${randomUUID()}`
    const reserved = persistentStore.reserveSponsorClaim({ claimId, eoa: session.eoa, safe: validated.safeAddress })
    if (!reserved.ok) {
      setResponseStatus(event, 409)
      persistentStore.recordAudit({ event: 'activate-claim-reuse', eoa: session.eoa, now, outcome: 'rejected' })
      return { ok: false, reason: 'claim-already-used' }
    }

    const prepared = await prepareSponsoredActivation({
      owner: session.eoa,
      safe: body!.safe!,
      userClicked: true,
      live: gates.live
    })

    persistentStore.recordAudit({ event: 'activate-sponsored', eoa: session.eoa, now, outcome: 'accepted' })
    return {
      ok: true,
      claimId: reserved.claimId,
      safe: prepared.safe,
      entryPoint: prepared.entryPoint,
      userOperation: prepared.userOperation,
      explorerBase: config.public.monadExplorerUrl
    }
  } catch (error) {
    gates.breaker.recordFailure(now)
    const reason = sanitizeActivationError(error)
    persistentStore.recordAudit({ event: 'activate-failed', eoa: session.eoa, now, outcome: 'rejected' })
    setResponseStatus(event, 400)
    return { ok: false, reason }
  }
})
