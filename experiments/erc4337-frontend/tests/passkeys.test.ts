import { describe, expect, it } from 'vitest'
import {
  getPasskeyByRawId,
  loadPasskeys,
  savePasskey,
  type PasskeyRecord,
  type StorageLike
} from '../app/lib/passkeys'
import { getSafePasskeyReadiness } from '../app/lib/safePasskeyConfig'
import { MONAD_ADD_MODULES_LIB, MONAD_SAFE_WEBAUTHN_SHARED_SIGNER, parseSafePasskeyNetworkId } from '../app/lib/safePasskeyNetworks'

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

describe('Safe passkey network parsing', () => {
  it('defaults to Sepolia for unknown query values', () => {
    expect(parseSafePasskeyNetworkId(undefined)).toBe('sepolia')
    expect(parseSafePasskeyNetworkId('mainnet')).toBe('sepolia')
  })

  it('selects Monad when requested', () => {
    expect(parseSafePasskeyNetworkId('monad')).toBe('monad')
  })
})

describe('Safe passkey readiness', () => {
  it('does not allow a sponsored deployment or mint when the Pimlico key is absent', () => {
    expect(getSafePasskeyReadiness('sepolia', '')).toEqual({
      ready: false,
      network: expect.objectContaining({ id: 'sepolia' }),
      message: '请先在 .env 设置 NUXT_PUBLIC_PIMLICO_API_KEY，才可部署 Safe 或发送练习 UserOperation。'
    })
  })

  it('builds Sepolia endpoints only when a key is explicitly configured', () => {
    const readiness = getSafePasskeyReadiness('sepolia', 'demo-key')
    expect(readiness.ready).toBe(true)
    if (readiness.ready) {
      expect(readiness.bundlerUrl).toContain('v2/11155111/rpc')
      expect(readiness.paymasterUrl).toBe(readiness.bundlerUrl)
      expect(readiness.bundlerUrl).toContain('add_balance_override&apikey=')
      expect(readiness.bundlerUrl).toContain('demo-key')
    }
  })

  it('builds Monad endpoints and injects custom contract addresses in the profile', () => {
    const readiness = getSafePasskeyReadiness('monad', { monadPimlicoApiKey: 'monad-key' })
    expect(readiness.ready).toBe(true)
    if (readiness.ready) {
      expect(readiness.bundlerUrl).toContain('v2/monad-testnet/rpc')
      expect(readiness.bundlerUrl).toContain('add_balance_override&apikey=')
      expect(readiness.bundlerUrl).toContain('monad-key')
      expect(readiness.network.customContracts).toEqual({
        entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
        safe4337ModuleAddress: '0xa581c4A4DB7175302464fF3C06380BC3270b4037',
        addModulesLibAddress: MONAD_ADD_MODULES_LIB,
        safeWebAuthnSharedSignerAddress: MONAD_SAFE_WEBAUTHN_SHARED_SIGNER
      })
      expect(readiness.network.practiceTargetAddress).toMatch(/^0x/)
    }
  })

  it('falls back to Sepolia Pimlico key on Monad when monad key is unset', () => {
    const readiness = getSafePasskeyReadiness('monad', { pimlicoApiKey: 'shared-key' })
    expect(readiness.ready).toBe(true)
    if (readiness.ready) {
      expect(readiness.bundlerUrl).toContain('shared-key')
    }
  })
})
