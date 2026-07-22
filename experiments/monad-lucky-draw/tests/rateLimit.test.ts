import { describe, expect, it } from 'vitest'
import {
  createBudgetGate,
  createCircuitBreaker,
  createInMemoryRateLimit
} from '../server/utils/rateLimit'

describe('sponsor rate limit', () => {
  it('allows the first request then cools down the same IP and EOA', () => {
    const gate = createInMemoryRateLimit({ windowMs: 60_000, maxPerWindow: 1 })
    expect(gate.allow({ ip: '1.1.1.1', eoa: '0x1111111111111111111111111111111111111111', now: 1_000 })).toBe(true)
    expect(gate.allow({ ip: '1.1.1.1', eoa: '0x2222222222222222222222222222222222222222', now: 1_001 })).toBe(false)
    expect(gate.allow({ ip: '2.2.2.2', eoa: '0x1111111111111111111111111111111111111111', now: 1_002 })).toBe(false)
    expect(gate.allow({ ip: '2.2.2.2', eoa: '0x2222222222222222222222222222222222222222', now: 1_003 })).toBe(true)
  })
})

describe('sponsor budget gate', () => {
  it('tracks remaining budget and rejects when exhausted', () => {
    const budget = createBudgetGate({ totalBudget: 1_000n, getSpent: () => 600n })
    expect(budget.available()).toBe(true)
    expect(budget.remaining()).toBe(400n)
    const exhausted = createBudgetGate({ totalBudget: 1_000n, getSpent: () => 1_000n })
    expect(exhausted.available()).toBe(false)
    expect(exhausted.remaining()).toBe(0n)
  })
})

describe('sponsor circuit breaker', () => {
  it('opens after consecutive failures and closes after cooldown', () => {
    const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 10_000 })
    expect(breaker.isClosed()).toBe(true)
    breaker.recordFailure(1_000)
    expect(breaker.isClosed(1_000)).toBe(true)
    breaker.recordFailure(1_001)
    expect(breaker.isClosed(1_001)).toBe(false)
    expect(breaker.isClosed(11_002)).toBe(true)
    breaker.recordSuccess()
    expect(breaker.isClosed()).toBe(true)
  })
})
