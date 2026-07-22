export const MONAD_TESTNET_CHAIN_ID = 10143

export interface AuthenticatedSession {
  id: string
  eoa: string
  expiresAt: number
  used: boolean
}

export interface SponsorPolicy {
  chainId: number
  target: string
  selector: `0x${string}`
  maxGas: bigint
  /** Maximum authorization lifetime in milliseconds. */
  maxExpiryMs: number
}

export interface SponsorClaim {
  chainId: number
  eoa: string
  safe: string
  target: string
  selector: string
  value: bigint
  gas: bigint
  expiresAt: number
  claimId: string
  session?: AuthenticatedSession
}

export type SponsorDecision = { allowed: true } | { allowed: false; reason: string }

const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const SELECTOR = /^0x[a-fA-F0-9]{8}$/
const CLAIM_ID = /^[A-Za-z0-9_-]{16,128}$/

const sameAddress = (left: string, right: string) => left.toLowerCase() === right.toLowerCase()

/** Pure allow-list policy. It intentionally produces no authorization or signature. */
export function evaluateSponsorClaim(policy: SponsorPolicy, claim: SponsorClaim, now: number, used: ReadonlySet<string>): SponsorDecision {
  if (policy.chainId !== MONAD_TESTNET_CHAIN_ID || claim.chainId !== MONAD_TESTNET_CHAIN_ID) return { allowed: false, reason: 'chain-not-allowed' }
  if (!ADDRESS.test(claim.eoa) || !ADDRESS.test(claim.safe)) return { allowed: false, reason: 'invalid-account' }
  if (!sameAddress(claim.target, policy.target)) return { allowed: false, reason: 'target-not-allowed' }
  if (!SELECTOR.test(claim.selector) || claim.selector.toLowerCase() !== policy.selector.toLowerCase()) return { allowed: false, reason: 'selector-not-allowed' }
  if (claim.value !== 0n) return { allowed: false, reason: 'nonzero-value-not-allowed' }
  if (claim.gas < 0n || claim.gas > policy.maxGas) return { allowed: false, reason: 'gas-not-allowed' }
  if (!Number.isFinite(claim.expiresAt) || claim.expiresAt <= now || claim.expiresAt > now + policy.maxExpiryMs) return { allowed: false, reason: 'expiry-not-allowed' }
  if (!CLAIM_ID.test(claim.claimId) || used.has(`claim:${claim.claimId}`)) return { allowed: false, reason: 'claim-used-or-invalid' }
  const session = claim.session
  if (!session || session.used || session.eoa.toLowerCase() !== claim.eoa.toLowerCase() || session.expiresAt <= now) return { allowed: false, reason: 'unauthenticated-session' }
  if (used.has(`eoa:${claim.eoa.toLowerCase()}`)) return { allowed: false, reason: 'eoa-already-used' }
  if (used.has(`safe:${claim.safe.toLowerCase()}`)) return { allowed: false, reason: 'safe-already-used' }
  return { allowed: true }
}
