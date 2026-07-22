export interface RateLimitGate { allow(input: { ip: string; eoa?: string; now: number }): boolean }
export interface BudgetGate { available(): boolean }
export interface CircuitBreaker { isClosed(): boolean }

/** Fail-closed placeholder until durable, distributed implementations are supplied. */
export const unavailableRateLimit: RateLimitGate = { allow: () => false }
