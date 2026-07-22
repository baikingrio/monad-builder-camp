import type { Hex } from 'viem'
import { submitSponsoredUserOperation } from '../../utils/activationExecution'
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

  const body = await readBody<{
    claimId?: string
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
  const claimed = persistentStore.hasSponsorClaim({ eoa: session.eoa, safe })
  if (!claimed || (body?.claimId && claimed !== body.claimId)) {
    setResponseStatus(event, 409)
    return { ok: false, reason: 'claim-not-found' }
  }
  if (!body?.userOperation || typeof body.userOperation !== 'object') {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'signed-user-operation-required' }
  }
  const signature = body.userOperation.signature
  if (typeof signature !== 'string' || signature === '0x' || signature.length < 130) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'owner-signature-required' }
  }
  if (String(body.userOperation.sender || '').toLowerCase() !== safe.toLowerCase()) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'sender-mismatch' }
  }

  try {
    const result = await submitSponsoredUserOperation({
      live: gates.live,
      userOperation: body.userOperation
    })
    if (!result.receipt?.success) {
      gates.breaker.recordFailure(now)
      persistentStore.recordAudit({ event: 'submit-failed', eoa: session.eoa, now, outcome: 'rejected' })
      setResponseStatus(event, 502)
      return { ok: false, reason: 'user-operation-failed', userOpHash: result.userOpHash }
    }

    const gas = BigInt(String(body.userOperation.callGasLimit ?? '0x0'))
      + BigInt(String(body.userOperation.verificationGasLimit ?? '0x0'))
      + BigInt(String(body.userOperation.preVerificationGas ?? '0x0'))
    persistentStore.addSponsorSpent(gas)
    persistentStore.completeSponsorClaim({ eoa: session.eoa, safe })
    gates.breaker.recordSuccess()
    persistentStore.recordAudit({ event: 'submit-succeeded', eoa: session.eoa, now, outcome: 'accepted' })

    const explorer = String(config.public.monadExplorerUrl || 'https://testnet.monadvision.com').replace(/\/$/, '')
    return {
      ok: true,
      userOpHash: result.userOpHash,
      txHash: result.receipt.txHash,
      safe,
      userOpUrl: `${explorer}/tx/${result.receipt.txHash as Hex}`,
      txUrl: `${explorer}/tx/${result.receipt.txHash as Hex}`
    }
  } catch (error) {
    gates.breaker.recordFailure(now)
    persistentStore.recordAudit({ event: 'submit-error', eoa: session.eoa, now, outcome: 'rejected' })
    setResponseStatus(event, 502)
    return { ok: false, reason: sanitizeActivationError(error) }
  }
})
