import { describe, expect, it } from 'vitest'
import { getHealthResponse, getRuntimeConfig } from '../server/utils/runtime-config'

const SPONSOR_ENVIRONMENT = {
  NUXT_SPONSOR_PRIVATE_KEY: `0x${'1'.repeat(64)}`,
  NUXT_PUBLIC_SPONSOR_PAYMASTER_ADDRESS: '0x2222222222222222222222222222222222222222',
  NUXT_PUBLIC_SPONSOR_CHECKIN_TARGET_ADDRESS: '0x3333333333333333333333333333333333333333'
}

describe('server runtime configuration', () => {
  it('reports unavailable sponsor authorization with fixed chain data and no secrets', () => {
    expect(getRuntimeConfig({})).toEqual({
      chainId: 10143,
      sponsorConfigured: false
    })
    expect(getHealthResponse({})).toEqual({
      status: 'ok',
      chainId: 10143,
      sponsorConfigured: false
    })
  })

  it('reports sponsor availability only when every signing dependency is configured without returning them', () => {
    expect(getRuntimeConfig({ NUXT_SPONSOR_PRIVATE_KEY: SPONSOR_ENVIRONMENT.NUXT_SPONSOR_PRIVATE_KEY })).toEqual({
      chainId: 10143,
      sponsorConfigured: false
    })
    expect(getRuntimeConfig({ ...SPONSOR_ENVIRONMENT, NUXT_SPONSOR_PRIVATE_KEY: 'not-a-private-key' })).toEqual({
      chainId: 10143,
      sponsorConfigured: false
    })

    const response = getHealthResponse(SPONSOR_ENVIRONMENT)
    expect(response).toEqual({
      status: 'ok',
      chainId: 10143,
      sponsorConfigured: true
    })
    expect(JSON.stringify(response)).not.toContain(SPONSOR_ENVIRONMENT.NUXT_SPONSOR_PRIVATE_KEY)
  })
})
