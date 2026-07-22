import type { PersistenceKind } from './store'

export interface SponsorRuntimeInput {
  enabled: boolean
  persistentStore: boolean
  sessionSecret: string
  signingKey: string
  paymasterConfig: string
  target: string
  budgetAvailable: boolean
  circuitBreakerAvailable: boolean
}
export interface SponsorReadiness { enabled: false; state: 'disabled'; persistence: PersistenceKind; missing: string[] }

/** Fail closed by design: signing is intentionally not implemented for Task 5. */
export function sponsorReadiness(input: SponsorRuntimeInput): SponsorReadiness {
  const missing = [
    !input.enabled && 'explicit-enabled-flag',
    !input.persistentStore && 'persistent-storage',
    !input.sessionSecret && 'session-secret',
    !input.signingKey && 'signing-key',
    !input.paymasterConfig && 'paymaster-config',
    !input.target && 'target-config',
    !input.budgetAvailable && 'budget',
    !input.circuitBreakerAvailable && 'circuit-breaker',
    'non-signing-task-boundary'
  ].filter((value): value is string => Boolean(value))
  return { enabled: false, state: 'disabled', persistence: 'development-only', missing }
}
