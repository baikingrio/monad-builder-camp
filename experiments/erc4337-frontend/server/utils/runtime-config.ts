export const MONAD_TESTNET_CHAIN_ID = 10143

type RelayEnvironment = Partial<Record<'NUXT_RELAY_URL' | 'NUXT_RELAY_API_KEY', string | undefined>>

export type HealthResponse = {
  status: 'ok'
  chainId: typeof MONAD_TESTNET_CHAIN_ID
  relayConfigured: boolean
}

export const getRuntimeConfig = (environment: RelayEnvironment = process.env): Omit<HealthResponse, 'status'> => ({
  chainId: MONAD_TESTNET_CHAIN_ID,
  relayConfigured: Boolean(environment.NUXT_RELAY_URL && environment.NUXT_RELAY_API_KEY)
})

export const getHealthResponse = (environment: RelayEnvironment = process.env): HealthResponse => ({
  status: 'ok',
  ...getRuntimeConfig(environment)
})
