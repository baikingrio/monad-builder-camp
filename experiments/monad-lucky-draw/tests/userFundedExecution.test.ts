import { describe, expect, it } from 'vitest'
import { MONAD_ACTIVATION_CONFIG } from '../app/lib/monadConfig'
import { getUserFundingStatus } from '../server/utils/userFundedExecution'

const SAFE = '0xb127994eed5f0aa8a42a446e796a2fcc0d1bb276'

describe('user-funded execution status', () => {
  it('returns only fixed EntryPoint, derived Safe, and serializable deposit balance', async () => {
    const result = await getUserFundingStatus({
      safe: SAFE,
      readBalance: async ({ entryPoint, safe }) => {
        expect(entryPoint).toBe(MONAD_ACTIVATION_CONFIG.entryPoint)
        expect(safe).toBe(SAFE)
        return 42000000000000000n
      },
      readNativeBalance: async (safe) => {
        expect(safe).toBe(SAFE)
        return 100000000000000000n
      }
    })

    expect(result).toEqual({
      entryPoint: MONAD_ACTIVATION_CONFIG.entryPoint,
      safe: SAFE,
      deposit: '42000000000000000',
      nativeBalance: '100000000000000000'
    })
    expect(JSON.stringify(result)).not.toMatch(/pimlico|apikey|private|secret|https?:/i)
  })

  it.each(['not-a-safe', '0x0000000000000000000000000000000000000000'])('rejects invalid Safe %s', async (safe) => {
    await expect(getUserFundingStatus({ safe, readBalance: async () => 0n })).rejects.toThrow(/Safe/)
  })
})
