import { getHealthResponse } from '../utils/runtime-config'

export default defineEventHandler(() => {
  const runtimeConfig = useRuntimeConfig()

  return getHealthResponse({
    NUXT_RELAY_URL: runtimeConfig.relayUrl,
    NUXT_RELAY_API_KEY: runtimeConfig.relayApiKey
  })
})
