export interface RateLimitGate {
  allow(input: { ip: string; eoa?: string; now: number }): boolean
}

export interface BudgetGate {
  available(): boolean
  remaining(): bigint
}

export interface CircuitBreaker {
  isClosed(now?: number): boolean
  recordFailure(now?: number): void
  recordSuccess(): void
}

/** Fail-closed placeholder until durable, distributed implementations are supplied. */
export const unavailableRateLimit: RateLimitGate = { allow: () => false }

export function createInMemoryRateLimit(options: {
  readonly windowMs: number
  readonly maxPerWindow: number
}): RateLimitGate {
  const hits = new Map<string, number[]>()
  const prune = (key: string, now: number): number[] => {
    const windowStart = now - options.windowMs
    const next = (hits.get(key) ?? []).filter((ts) => ts > windowStart)
    hits.set(key, next)
    return next
  }
  return {
    allow({ ip, eoa, now }) {
      const keys = [`ip:${ip}`, ...(eoa ? [`eoa:${eoa.toLowerCase()}`] : [])]
      for (const key of keys) {
        if (prune(key, now).length >= options.maxPerWindow) return false
      }
      for (const key of keys) {
        const list = hits.get(key) ?? []
        list.push(now)
        hits.set(key, list)
      }
      return true
    }
  }
}

export function createBudgetGate(options: {
  readonly totalBudget: bigint
  readonly getSpent: () => bigint
}): BudgetGate {
  return {
    available() {
      return this.remaining() > 0n
    },
    remaining() {
      const spent = options.getSpent()
      return spent >= options.totalBudget ? 0n : options.totalBudget - spent
    }
  }
}

export function createCircuitBreaker(options: {
  readonly failureThreshold: number
  readonly cooldownMs: number
}): CircuitBreaker {
  let failures = 0
  let openedAt: number | undefined
  return {
    isClosed(now = Date.now()) {
      if (openedAt === undefined) return true
      if (now - openedAt >= options.cooldownMs) {
        openedAt = undefined
        failures = 0
        return true
      }
      return false
    },
    recordFailure(now = Date.now()) {
      failures += 1
      if (failures >= options.failureThreshold) openedAt = now
    },
    recordSuccess() {
      failures = 0
      openedAt = undefined
    }
  }
}
