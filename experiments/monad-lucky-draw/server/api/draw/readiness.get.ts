import { sponsorReadiness } from '../../utils/runtime'

export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  return sponsorReadiness({
    enabled: config.luckyDrawSponsorSigningEnabled === true,
    persistentStore: false,
    sessionSecret: config.luckyDrawSessionSecret,
    signingKey: config.luckyDrawSponsorPrivateKey,
    paymasterConfig: config.luckyDrawPimlicoApiKey,
    target: config.public.luckyDrawContractAddress,
    budgetAvailable: false,
    circuitBreakerAvailable: false
  })
})
