import { describe, expect, it } from 'vitest'
import {
  getPasskeyByRawId,
  loadPasskeys,
  savePasskey,
  type PasskeyRecord,
  type StorageLike
} from '../app/lib/passkeys'
import { getSafePasskeyReadiness } from '../app/lib/safePasskeyConfig'

function createStorage(): StorageLike {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  }
}

const samplePasskey: PasskeyRecord = {
  rawId: 'credential-1',
  coordinates: { x: '11', y: '22' }
}

describe('passkey local persistence', () => {
  it('stores a passkey once and restores it using its raw ID', () => {
    const storage = createStorage()
    savePasskey(storage, samplePasskey)
    savePasskey(storage, samplePasskey)
    expect(loadPasskeys(storage)).toEqual([samplePasskey])
    expect(getPasskeyByRawId(storage, 'credential-1')).toEqual(samplePasskey)
  })

  it('returns no passkeys for corrupt browser storage instead of throwing', () => {
    const storage = createStorage()
    storage.setItem('safe_passkey_list', '{not json')
    expect(loadPasskeys(storage)).toEqual([])
  })
})

describe('Safe passkey readiness', () => {
  it('does not allow a sponsored deployment or mint when the Pimlico key is absent', () => {
    expect(getSafePasskeyReadiness('')).toEqual({
      ready: false,
      message: '请先在 .env 设置 NUXT_PUBLIC_PIMLICO_API_KEY，才可部署 Safe 或 Mint NFT。'
    })
  })

  it('builds Sepolia endpoints only when a key is explicitly configured', () => {
    const readiness = getSafePasskeyReadiness('demo-key')
    expect(readiness.ready).toBe(true)
    if (readiness.ready) {
      expect(readiness.bundlerUrl).toContain('v1/sepolia')
      expect(readiness.bundlerUrl).toContain('demo-key')
      expect(readiness.paymasterUrl).toContain('v2/sepolia')
    }
  })
})
