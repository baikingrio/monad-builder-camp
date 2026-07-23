import { deriveMonadCounterfactualSafe } from '../../../app/lib/safeAddress'
import { MONAD_ACTIVATION_CONFIG } from '../../../app/lib/monadConfig'
import { appendSessionSignature, assertSessionDrawSubmitBody, assertStoredSessionDrawOperation, submitSessionUserOperation } from '../../utils/sessionExecution'
import { sanitizeActivationError } from '../../utils/sanitizeActivationError'
import { consumeSessionGrantCall, readActiveSessionGrant } from '../../utils/sessionKeyStore'
import { resolveUserFundedExecution } from '../../utils/sponsorGates'
import { persistentStore } from '../../utils/sqliteStore'
import { createEntryPointBalanceReader } from '../../utils/userFundedExecution'

export default defineEventHandler(async (event) => {
  const now = Date.now()
  const config = useRuntimeConfig()
  const live = resolveUserFundedExecution(config)
  if (!live) {
    setResponseStatus(event, 503)
    return { ok: false, reason: 'user-funded-bundler-unavailable' }
  }
  const body = await readBody<Record<string, unknown>>(event)
  const sessionId = getCookie(event, 'lucky_draw_session')
  const session = typeof sessionId === 'string' ? persistentStore.readSession(sessionId, now) : undefined
  if (!session) {
    setResponseStatus(event, 401)
    return { ok: false, reason: 'unauthenticated-session' }
  }
  const expectedSafe = deriveMonadCounterfactualSafe({ owner: session.eoa, config: MONAD_ACTIVATION_CONFIG, saltNonce: 0n }).address
  try {
    const submitted = assertSessionDrawSubmitBody(body)
    if (typeof body?.safe === 'string' && body.safe.toLowerCase() !== expectedSafe.toLowerCase()) throw new Error('safe-mismatch')
    // Claim before any network call. A broadcast failure remains consumed; prepare afresh rather than retrying mutable input.
    const preparation = persistentStore.claimSessionDrawPreparation({ preparationId: submitted.preparationId, eoa: session.eoa, safe: expectedSafe, now })
    if (!preparation) {
      setResponseStatus(event, 409)
      return { ok: false, reason: 'session-draw-preparation-unavailable-or-consumed' }
    }
    const grant = readActiveSessionGrant({ eoa: session.eoa, safe: expectedSafe, now })
    if (!grant || grant.sessionAddress.toLowerCase() !== preparation.sessionAddress.toLowerCase()) throw new Error('session-grant-unavailable')
    // Validate exact persisted constraints and re-read the deposit immediately before send.
    const deposit = await createEntryPointBalanceReader()({ entryPoint: MONAD_ACTIVATION_CONFIG.entryPoint, safe: expectedSafe })
    assertStoredSessionDrawOperation({ userOperation: preparation.userOperation, safe: expectedSafe, expectedCallData: String(preparation.userOperation.callData), deposit })
    const result = await submitSessionUserOperation({ live, userOperation: appendSessionSignature({ userOperation: preparation.userOperation, signature: submitted.signature }) })
    if (!result.receipt?.success) {
      setResponseStatus(event, 502)
      return { ok: false, reason: 'session-draw-failed', userOpHash: result.userOpHash }
    }
    consumeSessionGrantCall({ eoa: session.eoa, safe: expectedSafe })
    persistentStore.recordAudit({ event: 'session-draw-succeeded', eoa: session.eoa, now, outcome: 'accepted' })
    const explorer = String(config.public.monadExplorerUrl || 'https://testnet.monadvision.com').replace(/\/$/, '')
    return { ok: true, userOpHash: result.userOpHash, txHash: result.receipt.txHash, txUrl: `${explorer}/tx/${result.receipt.txHash}`, remainingCalls: Math.max(0, grant.remainingCalls - 1) }
  } catch (error) {
    persistentStore.recordAudit({ event: 'session-draw-submit-error', eoa: session.eoa, now, outcome: 'rejected' })
    const reason = sanitizeActivationError(error)
    setResponseStatus(event, /insufficient EntryPoint deposit/i.test(reason) ? 409 : 400)
    return { ok: false, reason: /insufficient EntryPoint deposit/i.test(reason) ? 'insufficient-entrypoint-deposit' : reason }
  }
})
