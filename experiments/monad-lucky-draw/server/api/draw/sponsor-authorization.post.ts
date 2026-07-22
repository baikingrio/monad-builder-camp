import { sponsorReadiness } from '../../utils/runtime'
import { persistentStore } from '../../utils/sqliteStore'

/** Task 5 deliberately never creates a Paymaster/Sponsor authorization or a signature. */
export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  const readiness = sponsorReadiness({
    enabled: config.luckyDrawSponsorSigningEnabled === true,
    persistentStore: persistentStore.persistence === 'persistent',
    sessionSecret: config.luckyDrawSessionSecret,
    signingKey: config.luckyDrawSponsorPrivateKey,
    paymasterConfig: config.luckyDrawPimlicoApiKey,
    target: config.public.luckyDrawContractAddress,
    budgetAvailable: false,
    circuitBreakerAvailable: false
  })
  return { ...readiness, authorization: null }
})
