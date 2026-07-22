import { describe, expect, it } from 'vitest'
import { createLiveExecutionConfig } from '../server/utils/liveExecutionConfig'

const base = {
  enabled: true,
  apiKey: 'pim_test_key',
  sessionSecret: 'a'.repeat(32),
  rpcUrl: 'https://testnet-rpc.monad.xyz',
  maxGas: '20000000',
  totalBudget: '100000000000000000',
  safe4337Module: '0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226'
}

describe('live AA execution configuration', () => {
  it('enables only an explicit server-side Monad configuration and never exposes its Pimlico endpoint', () => {
    const config = createLiveExecutionConfig(base)

    expect(config).toMatchObject({ enabled: true, chainId: 10143, maxGas: 20000000n, totalBudget: 100000000000000000n })
    expect(JSON.stringify(config, (_, value) => typeof value === 'bigint' ? value.toString() : value)).not.toContain('pim_test_key')
    expect(Object.keys(config)).not.toContain('bundlerUrl')
    expect(Object.keys(config)).not.toContain('paymasterUrl')
  })

  it.each([
    ['the explicit enable flag is absent', { enabled: false }],
    ['the bundler credential is absent', { apiKey: '' }],
    ['the durable session secret is absent', { sessionSecret: '' }],
    ['the Monad RPC URL is absent', { rpcUrl: '' }],
    ['the gas cap is absent', { maxGas: '' }],
    ['the budget is absent', { totalBudget: '' }],
    ['the Safe4337 module is absent', { safe4337Module: '' }]
  ])('fails closed when %s', (_reason, override) => {
    expect(() => createLiveExecutionConfig({ ...base, ...override })).toThrow()
  })
})
