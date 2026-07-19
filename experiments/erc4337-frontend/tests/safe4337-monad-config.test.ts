import { describe, expect, it } from 'vitest'
import {
  MONAD_ENTRY_POINT_V07,
  MONAD_SAFE_4337_MODULE,
  MONAD_SAFE_V141,
  getMonadSafe4337Readiness
} from '../app/lib/safe4337MonadConfig'

describe('Monad Safe 4337 configuration', () => {
  it('pins the official Monad Testnet Safe 1.4.1, Safe 4337 Module and EntryPoint v0.7 addresses', () => {
    expect(MONAD_ENTRY_POINT_V07).toBe('0x0000000071727De22E5E9d8BAf0edAc6f37da032')
    expect(MONAD_SAFE_4337_MODULE).toBe('0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226')
    expect(MONAD_SAFE_V141).toBe('0x41675C099F32341bf84BFc5382aF534df5C7461a')
  })

  it('keeps live deployment disabled without a Monad-specific Pimlico key', () => {
    expect(getMonadSafe4337Readiness('')).toEqual({
      ready: false,
      message: '请先设置 NUXT_PUBLIC_MONAD_PIMLICO_API_KEY，才可发送 Monad Safe UserOperation。'
    })
  })

  it('uses the Monad Testnet Pimlico v2 endpoint only with an explicit key', () => {
    const readiness = getMonadSafe4337Readiness('demo-key')
    expect(readiness.ready).toBe(true)
    if (readiness.ready) {
      expect(readiness.bundlerUrl).toContain('/v2/10143/rpc?')
      expect(readiness.bundlerUrl).toContain('demo-key')
      expect(readiness.paymasterUrl).toBe(readiness.bundlerUrl)
    }
  })
})
