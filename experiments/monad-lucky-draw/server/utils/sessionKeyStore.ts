import { createSessionKeyGrantDraft } from '../../app/lib/sessionKeyPolicy'
import { persistentStore, type SessionGrantRecord } from './sqliteStore'

export function upsertPendingSessionGrant(input: {
  eoa: string
  safe: string
  sessionAddress: string
  now: number
}): SessionGrantRecord {
  const draft = createSessionKeyGrantDraft(input)
  return persistentStore.upsertPendingSessionGrant({
    eoa: draft.eoa,
    safe: draft.safe,
    sessionAddress: draft.sessionAddress,
    expiresAt: draft.expiresAt,
    remainingCalls: draft.remainingCalls,
    now: input.now
  })
}

export function activateSessionGrant(input: { eoa: string; safe: string; sessionAddress: string }): boolean {
  return persistentStore.activateSessionGrant(input)
}

export function readActiveSessionGrant(input: { eoa: string; safe: string; now: number }): SessionGrantRecord | undefined {
  return persistentStore.readActiveSessionGrant(input)
}

export function consumeSessionGrantCall(input: { eoa: string; safe: string }): boolean {
  return persistentStore.consumeSessionGrantCall(input)
}
