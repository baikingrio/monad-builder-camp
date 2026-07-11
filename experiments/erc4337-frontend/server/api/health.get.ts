import { getHealthResponse } from '../utils/runtime-config'

export default defineEventHandler(() => {
  const runtimeConfig = useRuntimeConfig()

  return getHealthResponse({
    NUXT_SPONSOR_PRIVATE_KEY: runtimeConfig.sponsorPrivateKey,
    NUXT_PUBLIC_SPONSOR_PAYMASTER_ADDRESS: runtimeConfig.public.SPONSOR_PAYMASTER_ADDRESS,
    NUXT_PUBLIC_SPONSOR_CHECKIN_TARGET_ADDRESS: runtimeConfig.public.SPONSOR_CHECKIN_TARGET_ADDRESS
  })
})
