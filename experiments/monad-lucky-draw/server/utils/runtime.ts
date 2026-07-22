import type { PersistenceKind } from './store'

export interface SponsorRuntimeInput {
  enabled: boolean
  persistentStore: boolean
  sessionSecret: string
  /** Pimlico API key or equivalent paymaster credential — never returned in responses. */
  paymasterConfig: string
  target: string
  budgetAvailable: boolean
  circuitBreakerAvailable: boolean
}

export type SponsorReadiness =
  | { enabled: true; state: 'ready'; persistence: PersistenceKind; missing: readonly [] }
  | { enabled: false; state: 'disabled'; persistence: PersistenceKind; missing: string[] }

/** Fail closed unless every production gate is present. Pimlico paymaster replaces a private sponsor key. */
export function sponsorReadiness(input: SponsorRuntimeInput): SponsorReadiness {
  const missing = [
    !input.enabled && 'explicit-enabled-flag',
    !input.persistentStore && 'persistent-storage',
    input.sessionSecret.length < 32 && 'session-secret',
    !input.paymasterConfig && 'paymaster-config',
    !input.target && 'target-config',
    !input.budgetAvailable && 'budget',
    !input.circuitBreakerAvailable && 'circuit-breaker'
  ].filter((value): value is string => Boolean(value))

  const persistence: PersistenceKind = input.persistentStore ? 'persistent' : 'development-only'
  if (missing.length > 0) {
    return { enabled: false, state: 'disabled', persistence, missing }
  }
  return { enabled: true, state: 'ready', persistence: 'persistent', missing: [] }
}
