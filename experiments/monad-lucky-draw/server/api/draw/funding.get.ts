import { deriveMonadCounterfactualSafe } from '../../../app/lib/safeAddress'
import { MONAD_ACTIVATION_CONFIG } from '../../../app/lib/monadConfig'
import { createEntryPointBalanceReader, getUserFundingStatus } from '../../utils/userFundedExecution'
import { persistentStore } from '../../utils/sqliteStore'

export default defineEventHandler(async (event) => {
  const now = Date.now()
  const sessionId = getCookie(event, 'lucky_draw_session')
  const session = typeof sessionId === 'string' ? persistentStore.readSession(sessionId, now) : undefined
  if (!session) {
    setResponseStatus(event, 401)
    return { ok: false, reason: 'unauthenticated-session' }
  }

  const safe = deriveMonadCounterfactualSafe({ owner: session.eoa, config: MONAD_ACTIVATION_CONFIG, saltNonce: 0n }).address
  try {
    return { ok: true, ...(await getUserFundingStatus({ safe, readBalance: createEntryPointBalanceReader() })) }
  } catch {
    setResponseStatus(event, 502)
    return { ok: false, reason: 'entrypoint-deposit-unavailable' }
  }
})
