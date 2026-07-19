import type { PasskeyArgType } from '@safe-global/protocol-kit'

export const STORAGE_PASSKEY_LIST_KEY = 'safe_passkey_list'

export type PasskeyRecord = PasskeyArgType

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function loadPasskeys(storage: StorageLike): PasskeyRecord[] {
  const stored = storage.getItem(STORAGE_PASSKEY_LIST_KEY)
  if (!stored) return []

  try {
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed as PasskeyRecord[] : []
  } catch {
    return []
  }
}

export function savePasskey(storage: StorageLike, passkey: PasskeyRecord): void {
  const passkeys = loadPasskeys(storage)
  if (!passkeys.some((item) => item.rawId === passkey.rawId)) {
    storage.setItem(STORAGE_PASSKEY_LIST_KEY, JSON.stringify([...passkeys, passkey]))
  }
}

export function getPasskeyByRawId(storage: StorageLike, rawId: string): PasskeyRecord | undefined {
  return loadPasskeys(storage).find((passkey) => passkey.rawId === rawId)
}
