import { describe, expect, it } from 'vitest'
import { buildPimlicoV2RpcUrl, PIMLICO_MONAD_TESTNET_CHAIN } from '../app/lib/pimlicoEndpoints'

describe('Pimlico v2 RPC URLs', () => {
  it('uses add_balance_override flag without equals for Monad slug', () => {
    const url = buildPimlicoV2RpcUrl(PIMLICO_MONAD_TESTNET_CHAIN, 'demo-key')
    expect(url).toBe(
      'https://api.pimlico.io/v2/monad-testnet/rpc?add_balance_override&apikey=demo-key'
    )
  })
})
