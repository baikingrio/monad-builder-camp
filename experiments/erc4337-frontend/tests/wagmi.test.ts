import { describe, expect, it } from 'vitest'
import { config } from '../src/lib/wagmi'
import { monadTestnet } from '../src/lib/erc4337Experiments'

describe('wagmi core config', () => {
  it('targets Monad Testnet and exposes a public RPC transport', () => {
    expect(config.chains[0].id).toBe(monadTestnet.id)
    expect(config.chains[0].rpcUrls.default.http[0]).toContain('monad')
  })
})
