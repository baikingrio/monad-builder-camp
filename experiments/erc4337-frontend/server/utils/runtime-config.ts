import { isAddress } from 'viem'

export const MONAD_TESTNET_CHAIN_ID = 10143

type SponsorEnvironment = Partial<Record<
  | 'NUXT_SPONSOR_PRIVATE_KEY'
  | 'NUXT_PUBLIC_SPONSOR_PAYMASTER_ADDRESS'
  | 'NUXT_PUBLIC_SPONSOR_CHECKIN_TARGET_ADDRESS',
  string | undefined
>>

export type HealthResponse = {
  status: 'ok'
  chainId: typeof MONAD_TESTNET_CHAIN_ID
  sponsorConfigured: boolean
}

export const getRuntimeConfig = (environment: SponsorEnvironment = process.env): Omit<HealthResponse, 'status'> => ({
  chainId: MONAD_TESTNET_CHAIN_ID,
  sponsorConfigured: Boolean(
    environment.NUXT_SPONSOR_PRIVATE_KEY?.match(/^0x[0-9a-fA-F]{64}$/)
    && isAddress(environment.NUXT_PUBLIC_SPONSOR_PAYMASTER_ADDRESS)
    && isAddress(environment.NUXT_PUBLIC_SPONSOR_CHECKIN_TARGET_ADDRESS)
  )
})

export const getHealthResponse = (environment: SponsorEnvironment = process.env): HealthResponse => ({
  status: 'ok',
  ...getRuntimeConfig(environment)
})
