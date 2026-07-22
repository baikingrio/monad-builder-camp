import { sponsorReadiness } from '../../utils/runtime'
import { persistentStore } from '../../utils/sqliteStore'

export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  return sponsorReadiness({
    enabled: config.luckyDrawSponsorSigningEnabled === true,
    persistentStore: persistentStore.persistence === 'persistent',
    sessionSecret: config.luckyDrawSessionSecret,
    signingKey: config.luckyDrawSponsorPrivateKey,
    paymasterConfig: config.luckyDrawPimlicoApiKey,
    target: config.public.luckyDrawContractAddress,
    budgetAvailable: false,
    circuitBreakerAvailable: false
  })
})
