export interface StoredSessionKey {
  readonly eoa: string
  readonly safe: string
  readonly address: string
  readonly privateKey: `0x${string}`
  readonly expiresAt: number
}

const STORAGE_PREFIX = 'monad-lucky-draw:session-key:'

function storageKey(eoa: string, safe: string): string {
  return `${STORAGE_PREFIX}${eoa.toLowerCase()}:${safe.toLowerCase()}`
}

/** Browser-only Session Key material. Never stores sponsor/server secrets. */
export function saveSessionKey(record: StoredSessionKey, storage: Storage = localStorage): void {
  if (/pimlico|apikey|sponsor/i.test(JSON.stringify(record))) throw new Error('session storage rejected secret-like payload')
  storage.setItem(storageKey(record.eoa, record.safe), JSON.stringify(record))
}

export function loadSessionKey(eoa: string, safe: string, storage: Storage = localStorage, now = Date.now()): StoredSessionKey | undefined {
  const raw = storage.getItem(storageKey(eoa, safe))
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as StoredSessionKey
    if (!parsed?.privateKey || !parsed?.address) return undefined
    if (parsed.expiresAt <= now) {
      storage.removeItem(storageKey(eoa, safe))
      return undefined
    }
    return parsed
  } catch {
    return undefined
  }
}

export function clearSessionKey(eoa: string, safe: string, storage: Storage = localStorage): void {
  storage.removeItem(storageKey(eoa, safe))
}
