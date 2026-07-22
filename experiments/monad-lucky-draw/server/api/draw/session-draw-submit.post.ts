import { submitSessionUserOperation } from '../../utils/sessionExecution'
import { sanitizeActivationError } from '../../utils/sanitizeActivationError'
import { consumeSessionGrantCall, readActiveSessionGrant } from '../../utils/sessionKeyStore'
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

  const body = await readBody<{
    safe?: string
    userOperation?: Record<string, unknown>
  }>(event)
  const sessionId = getCookie(event, 'lucky_draw_session')
  const session = typeof sessionId === 'string' ? persistentStore.readSession(sessionId, now) : undefined
  if (!session) {
    setResponseStatus(event, 401)
    return { ok: false, reason: 'unauthenticated-session' }
  }
  const safe = typeof body?.safe === 'string' ? body.safe : ''
  const grant = readActiveSessionGrant({ eoa: session.eoa, safe, now })
  if (!grant) {
    setResponseStatus(event, 409)
    return { ok: false, reason: 'session-grant-unavailable' }
  }
  const signature = body?.userOperation?.signature
  if (!body?.userOperation || typeof signature !== 'string' || signature === '0x' || signature.length < 130) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'session-signature-required' }
  }
  if (String(body.userOperation.sender || '').toLowerCase() !== grant.safe.toLowerCase()) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'sender-mismatch' }
  }

  try {
    const result = await submitSessionUserOperation({ live: gates.live, userOperation: body.userOperation })
    if (!result.receipt?.success) {
      setResponseStatus(event, 502)
      return { ok: false, reason: 'session-draw-failed', userOpHash: result.userOpHash }
    }
    consumeSessionGrantCall({ eoa: session.eoa, safe })
    persistentStore.recordAudit({ event: 'session-draw-succeeded', eoa: session.eoa, now, outcome: 'accepted' })
    const explorer = String(config.public.monadExplorerUrl || 'https://testnet.monadvision.com').replace(/\/$/, '')
    return {
      ok: true,
      userOpHash: result.userOpHash,
      txHash: result.receipt.txHash,
      txUrl: `${explorer}/tx/${result.receipt.txHash}`,
      remainingCalls: Math.max(0, grant.remainingCalls - 1)
    }
  } catch (error) {
    persistentStore.recordAudit({ event: 'session-draw-submit-error', eoa: session.eoa, now, outcome: 'rejected' })
    setResponseStatus(event, 502)
    return { ok: false, reason: sanitizeActivationError(error) }
  }
})
