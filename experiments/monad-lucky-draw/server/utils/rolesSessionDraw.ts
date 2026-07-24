import { createPublicClient, defineChain, http, type Address, type Hex } from 'viem'
import { evaluateSessionKeyDraw } from '../../app/lib/sessionKeyPolicy'
import { MONAD_ACTIVATION_CONFIG } from '../../app/lib/monadConfig'
import {
  assertRolesDrawTransaction,
  buildRolesDrawTransaction
} from '../../app/lib/rolesPermissions'
import { LUCKY_DRAW_DRAW_SELECTOR } from '../../app/lib/userOperationSimulation'
import type { SessionGrantRecord } from './sqliteStore'

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
})

export interface RolesDrawPreparation {
  readonly to: Address
  readonly value: bigint
  readonly data: Hex
  readonly rolesModifier: Address
  readonly sessionAddress: Address
  readonly remainingCalls: number
  readonly expiresAt: number
  readonly sessionBalanceWei: string
  readonly estimatedGasTipFloorWei: string
}

/** Prepare a Session Key EOA tx to Roles.execTransactionWithRole(draw). No bundler / UserOp. */
export async function prepareRolesSessionDraw(input: {
  readonly grant: SessionGrantRecord
  readonly now: number
  readonly rpcUrl?: string
}): Promise<RolesDrawPreparation> {
  if (input.grant.mode !== 'roles') throw new Error('grant-not-roles-mode')
  if (!input.grant.rolesModifier) throw new Error('roles-modifier-missing-on-grant')

  const decision = evaluateSessionKeyDraw({
    grant: {
      eoa: input.grant.eoa,
      safe: input.grant.safe,
      sessionAddress: input.grant.sessionAddress,
      expiresAt: input.grant.expiresAt,
      remainingCalls: input.grant.remainingCalls,
      onchainAuthorized: input.grant.status === 'active'
    },
    target: MONAD_ACTIVATION_CONFIG.luckyDraw,
    selector: LUCKY_DRAW_DRAW_SELECTOR,
    value: 0n,
    now: input.now,
    unlimitedCalls: true
  })
  if (!decision.allowed) throw new Error(decision.reason)

  const rolesModifier = input.grant.rolesModifier as Address
  const tx = buildRolesDrawTransaction({ rolesModifier })
  assertRolesDrawTransaction({
    to: tx.to,
    value: tx.value,
    data: tx.data,
    rolesModifier
  })

  const client = createPublicClient({
    chain: monadTestnet,
    transport: http(input.rpcUrl ?? monadTestnet.rpcUrls.default.http[0])
  })
  const balance = await client.getBalance({ address: input.grant.sessionAddress as Address })

  return {
    to: tx.to,
    value: tx.value,
    data: tx.data,
    rolesModifier,
    sessionAddress: input.grant.sessionAddress as Address,
    remainingCalls: input.grant.remainingCalls,
    expiresAt: input.grant.expiresAt,
    sessionBalanceWei: balance.toString(),
    estimatedGasTipFloorWei: '10000000000000' // 0.00001 MON soft floor for UI hinting
  }
}

export function assertRolesDrawConfirmBody(body: Record<string, unknown> | null | undefined): {
  preparationId: string
  txHash: string
} {
  if (!body || typeof body.preparationId !== 'string' || body.preparationId.length < 1) {
    throw new Error('roles preparation ID is required')
  }
  if (typeof body.txHash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(body.txHash)) {
    throw new Error('roles draw txHash is required')
  }
  if (Object.keys(body).some(key => !['preparationId', 'txHash', 'safe'].includes(key))) {
    throw new Error('unexpected roles draw confirm fields')
  }
  return { preparationId: body.preparationId, txHash: body.txHash }
}
