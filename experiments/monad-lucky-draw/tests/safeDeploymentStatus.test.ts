import { describe, expect, it, vi } from 'vitest'
import { MONAD_TESTNET_CHAIN, checkMonadSafeDeploymentStatus } from '../app/lib/safeDeploymentStatus'

const SAFE = '0x59cB895943D081a4b102aA22d19Eda1FabFD37d7'

describe('read-only Monad Safe deployment status', () => {
  it('reports deployed only when eth_getCode returns nonempty bytecode', async () => {
    const getCode = vi.fn().mockResolvedValue('0x60016000')

    await expect(checkMonadSafeDeploymentStatus(SAFE, getCode)).resolves.toEqual({ kind: 'deployed', chainId: 10143 })
    expect(getCode).toHaveBeenCalledOnce()
    expect(getCode).toHaveBeenCalledWith({ address: SAFE, chain: MONAD_TESTNET_CHAIN })
  })

  it('reports not-deployed only when eth_getCode returns exactly 0x', async () => {
    await expect(checkMonadSafeDeploymentStatus(SAFE, vi.fn().mockResolvedValue('0x'))).resolves.toEqual({ kind: 'not-deployed', chainId: 10143 })
  })

  it('does not treat an absent or otherwise non-code response as deployed', async () => {
    await expect(checkMonadSafeDeploymentStatus(SAFE, vi.fn().mockResolvedValue(undefined))).resolves.toMatchObject({ kind: 'not-deployed', chainId: 10143 })
  })

  it('reports unavailable when the RPC read fails', async () => {
    await expect(checkMonadSafeDeploymentStatus(SAFE, vi.fn().mockRejectedValue(new Error('RPC unavailable')))).resolves.toMatchObject({ kind: 'unavailable', chainId: 10143 })
  })
})
