import { describe, expect, it } from 'vitest'
import { clearSessionKey, loadSessionKey, saveSessionKey } from '../app/lib/sessionKeyStorage'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear() { map.clear() },
    getItem(key) { return map.has(key) ? map.get(key)! : null },
    key() { return null },
    removeItem(key) { map.delete(key) },
    setItem(key, value) { map.set(key, value) }
  }
}

describe('session key browser storage', () => {
  it('stores and loads a user session key without accepting sponsor-like payloads', () => {
    const storage = memoryStorage()
    const record = {
      eoa: '0x7c0343c808b827e4286381c2292d92c3f19152a4',
      safe: '0xb127994eed5f0aa8a42a446e796a2fcc0d1bb276',
      address: '0x1111111111111111111111111111111111111111',
      privateKey: `0x${'11'.repeat(32)}` as `0x${string}`,
      expiresAt: Date.now() + 60_000
    }
    saveSessionKey(record, storage)
    expect(loadSessionKey(record.eoa, record.safe, storage)?.address).toBe(record.address)
    expect(() => saveSessionKey({ ...record, privateKey: '0xpimlico_secret' as `0x${string}` }, storage)).toThrow(/secret/i)
    clearSessionKey(record.eoa, record.safe, storage)
    expect(loadSessionKey(record.eoa, record.safe, storage)).toBeUndefined()
  })
})
