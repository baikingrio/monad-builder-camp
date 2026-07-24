import { createPublicClient, defineChain, http, type Address, type Hex } from 'viem'
import { deriveMonadCounterfactualSafe } from '../../../app/lib/safeAddress'
import { MONAD_ACTIVATION_CONFIG } from '../../../app/lib/monadConfig'
import { assertRolesDrawTransaction } from '../../../app/lib/rolesPermissions'
import { sanitizeActivationError } from '../../utils/sanitizeActivationError'
import { assertRolesDrawConfirmBody } from '../../utils/rolesSessionDraw'
import { consumeSessionGrantCall, readActiveSessionGrant } from '../../utils/sessionKeyStore'
import { persistentStore } from '../../utils/sqliteStore'

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
})

/**
 * Confirm a Roles-mode session draw after the Session Key EOA tx is mined.
 * Validates the stored preparation matches the fixed Roles draw calldata, then consumes one call.
 */
export default defineEventHandler(async (event) => {
  const now = Date.now()
  if (MONAD_ACTIVATION_CONFIG.rolesSessionEnabled !== true) {
    setResponseStatus(event, 503)
    return { ok: false, reason: 'roles-session-feature-disabled' }
  }

  const body = await readBody<Record<string, unknown>>(event)
  const sessionId = getCookie(event, 'lucky_draw_session')
  const session = typeof sessionId === 'string' ? persistentStore.readSession(sessionId, now) : undefined
  if (!session) {
    setResponseStatus(event, 401)
    return { ok: false, reason: 'unauthenticated-session' }
  }

  const expectedSafe = deriveMonadCounterfactualSafe({ owner: session.eoa, config: MONAD_ACTIVATION_CONFIG, saltNonce: 0n }).address
  const safe = typeof body?.safe === 'string' ? body.safe : expectedSafe
  if (safe.toLowerCase() !== expectedSafe.toLowerCase()) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'safe-mismatch' }
  }

  try {
    const { preparationId, txHash } = assertRolesDrawConfirmBody(body)
    const preparation = persistentStore.claimSessionDrawPreparation({
      preparationId,
      eoa: session.eoa,
      safe: expectedSafe,
      now
    })
    if (!preparation?.rolesTransaction) {
      setResponseStatus(event, 409)
      return { ok: false, reason: 'roles-preparation-unavailable' }
    }

    assertRolesDrawTransaction({
      to: preparation.rolesTransaction.to,
      value: BigInt(preparation.rolesTransaction.value),
      data: preparation.rolesTransaction.data as Hex,
      rolesModifier: preparation.rolesTransaction.rolesModifier
    })

    const config = useRuntimeConfig()
    const client = createPublicClient({
      chain: monadTestnet,
      transport: http(String(config.public.monadRpcUrl || 'https://testnet-rpc.monad.xyz'))
    })
    const receipt = await client.getTransactionReceipt({ hash: txHash as Hex })
    if (!receipt || receipt.status !== 'success') {
      setResponseStatus(event, 400)
      return { ok: false, reason: 'roles-draw-tx-not-successful' }
    }
    if (receipt.to?.toLowerCase() !== preparation.rolesTransaction.to.toLowerCase()) {
      setResponseStatus(event, 400)
      return { ok: false, reason: 'roles-draw-tx-target-mismatch' }
    }

    const grant = readActiveSessionGrant({ eoa: session.eoa, safe: expectedSafe, now })
    if (!grant || grant.mode !== 'roles') {
      setResponseStatus(event, 409)
      return { ok: false, reason: 'session-grant-unavailable' }
    }

    if (!consumeSessionGrantCall({ eoa: session.eoa, safe: expectedSafe })) {
      setResponseStatus(event, 409)
      return { ok: false, reason: 'session-exhausted' }
    }

    // Roles self-paid: call count is not decremented; TTL still applies.
    persistentStore.recordAudit({ event: 'roles-session-draw-confirmed', eoa: session.eoa, now, outcome: 'accepted' })
    return {
      ok: true,
      mode: 'roles',
      txHash,
      txUrl: `https://testnet.monadvision.com/tx/${txHash}`,
      remainingCalls: grant.remainingCalls,
      unlimitedCalls: true,
      sessionAddress: preparation.sessionAddress as Address
    }
  } catch (error) {
    persistentStore.recordAudit({ event: 'roles-session-draw-confirm-failed', eoa: session.eoa, now, outcome: 'rejected' })
    setResponseStatus(event, 400)
    return { ok: false, reason: sanitizeActivationError(error) }
  }
})
