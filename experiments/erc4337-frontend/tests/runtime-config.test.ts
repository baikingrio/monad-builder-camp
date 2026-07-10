import { describe, expect, it } from 'vitest'
import { getHealthResponse, getRuntimeConfig } from '../server/utils/runtime-config'

describe('server runtime configuration', () => {
  it('reports an unconfigured relay without exposing or requiring server secrets', () => {
    expect(getRuntimeConfig({})).toEqual({
      chainId: 10143,
      relayConfigured: false
    })
    expect(getHealthResponse({})).toEqual({
      status: 'ok',
      chainId: 10143,
      relayConfigured: false
    })
  })

  it('only reports relay availability when both server-only relay settings exist', () => {
    expect(getRuntimeConfig({ NUXT_RELAY_URL: 'https://relay.example' })).toMatchObject({
      relayConfigured: false
    })
    expect(getRuntimeConfig({
      NUXT_RELAY_URL: 'https://relay.example',
      NUXT_RELAY_API_KEY: 'server-only-secret'
    })).toEqual({
      chainId: 10143,
      relayConfigured: true
    })
  })
})
