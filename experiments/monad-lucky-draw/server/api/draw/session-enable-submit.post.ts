import { submitSessionUserOperation } from '../../utils/sessionExecution'
import { sanitizeActivationError } from '../../utils/sanitizeActivationError'
import { activateSessionGrant } from '../../utils/sessionKeyStore'
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
    sessionAddress?: string
    userOperation?: Record<string, unknown>
  }>(event)
  const sessionId = getCookie(event, 'lucky_draw_session')
  const session = typeof sessionId === 'string' ? persistentStore.readSession(sessionId, now) : undefined
  if (!session) {
    setResponseStatus(event, 401)
    return { ok: false, reason: 'unauthenticated-session' }
  }
  const safe = typeof body?.safe === 'string' ? body.safe : ''
  const sessionAddress = typeof body?.sessionAddress === 'string' ? body.sessionAddress : ''
  const signature = body?.userOperation?.signature
  if (!body?.userOperation || typeof signature !== 'string' || signature === '0x' || signature.length < 130) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'owner-signature-required' }
  }

  try {
    const result = await submitSessionUserOperation({ live: gates.live, userOperation: body.userOperation })
    if (!result.receipt?.success) {
      setResponseStatus(event, 502)
      return { ok: false, reason: 'session-enable-userop-failed', userOpHash: result.userOpHash }
    }
    if (!activateSessionGrant({ eoa: session.eoa, safe, sessionAddress })) {
      setResponseStatus(event, 409)
      return { ok: false, reason: 'session-grant-missing' }
    }
    persistentStore.recordAudit({ event: 'session-enable-succeeded', eoa: session.eoa, now, outcome: 'accepted' })
    const explorer = String(config.public.monadExplorerUrl || 'https://testnet.monadvision.com').replace(/\/$/, '')
    return {
      ok: true,
      userOpHash: result.userOpHash,
      txHash: result.receipt.txHash,
      txUrl: `${explorer}/tx/${result.receipt.txHash}`
    }
  } catch (error) {
    persistentStore.recordAudit({ event: 'session-enable-submit-error', eoa: session.eoa, now, outcome: 'rejected' })
    setResponseStatus(event, 502)
    return { ok: false, reason: sanitizeActivationError(error) }
  }
})
