import { createBudgetGate, createCircuitBreaker, createInMemoryRateLimit, type BudgetGate, type CircuitBreaker, type RateLimitGate } from './rateLimit'
import { createLiveExecutionConfig, type LiveExecutionConfig } from './liveExecutionConfig'
import { sponsorReadiness, type SponsorReadiness } from './runtime'
import { persistentStore } from './sqliteStore'

export interface SponsorGates {
  readonly readiness: SponsorReadiness
  readonly rateLimit: RateLimitGate
  readonly budget: BudgetGate
  readonly breaker: CircuitBreaker
  readonly live?: LiveExecutionConfig
}

const rateLimit = createInMemoryRateLimit({ windowMs: 60_000, maxPerWindow: 3 })
const breaker = createCircuitBreaker({ failureThreshold: 5, cooldownMs: 5 * 60_000 })

/**
 * Builds the live sponsor gate view from Nitro runtime config.
 * Secrets stay in closures; readiness responses never serialize them.
 */
export function resolveSponsorGates(config: {
  luckyDrawSponsorSigningEnabled: boolean
  luckyDrawSessionSecret: string
  luckyDrawPimlicoApiKey: string
  luckyDrawSponsorMaxGas: string
  luckyDrawSponsorTotalBudget: string
  luckyDrawSafe4337Module: string
  public: { monadRpcUrl: string; luckyDrawContractAddress: string }
}): SponsorGates {
  let live: LiveExecutionConfig | undefined
  try {
    if (config.luckyDrawSponsorSigningEnabled === true) {
      live = createLiveExecutionConfig({
        enabled: true,
        apiKey: config.luckyDrawPimlicoApiKey,
        sessionSecret: config.luckyDrawSessionSecret,
        rpcUrl: config.public.monadRpcUrl || 'https://testnet-rpc.monad.xyz',
        maxGas: config.luckyDrawSponsorMaxGas,
        totalBudget: config.luckyDrawSponsorTotalBudget,
        safe4337Module: config.luckyDrawSafe4337Module
      })
    }
  } catch {
    live = undefined
  }

  const budget = createBudgetGate({
    totalBudget: live?.totalBudget ?? 0n,
    getSpent: () => persistentStore.getSponsorSpent()
  })

  const readiness = sponsorReadiness({
    enabled: config.luckyDrawSponsorSigningEnabled === true,
    persistentStore: persistentStore.persistence === 'persistent',
    sessionSecret: config.luckyDrawSessionSecret,
    paymasterConfig: config.luckyDrawPimlicoApiKey,
    target: config.public.luckyDrawContractAddress,
    budgetAvailable: live !== undefined && budget.available(),
    circuitBreakerAvailable: breaker.isClosed()
  })

  return { readiness, rateLimit, budget, breaker, live: readiness.enabled ? live : undefined }
}
