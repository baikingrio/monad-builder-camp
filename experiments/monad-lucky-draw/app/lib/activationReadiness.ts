import { createMonadActivationConfig, type MonadActivationConfig } from './monadConfig'

const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ECDSA_SIGNATURE = /^0x[a-fA-F0-9]{130}$/

export interface VerifiedOwnerAuthorization {
  readonly owner: string
  readonly signature: string
  /** Set exclusively by a completed cryptographic verification boundary. */
  readonly cryptographicallyVerified: boolean
}

export interface SponsorPolicyReadiness {
  /** A durable policy store is required; an in-memory grant is insufficient. */
  readonly persistent: boolean
  readonly authorized: boolean
}

export interface ActivationReadinessInput {
  readonly config: MonadActivationConfig
  readonly ownerAuthorization?: VerifiedOwnerAuthorization
  readonly sponsorPolicy: SponsorPolicyReadiness
  /** Only a real, explicit activation control click may set this true. */
  readonly userClicked: boolean
}

export interface ActivationReadiness {
  readonly canConstructUserOperation: boolean
  readonly blockers: readonly string[]
}

export function createVerifiedOwnerAuthorization(input: VerifiedOwnerAuthorization): VerifiedOwnerAuthorization {
  if (!ADDRESS.test(input.owner)) throw new Error('owner must be a 20-byte Ethereum address')
  if (!ECDSA_SIGNATURE.test(input.signature)) throw new Error('owner authorization requires a 65-byte ECDSA signature')
  return Object.freeze({ ...input })
}

/** Pure gate only: it requests no signature, performs no RPC simulation, and sends nothing. */
export function evaluateActivationReadiness(input: ActivationReadinessInput): ActivationReadiness {
  const blockers: string[] = []
  try {
    createMonadActivationConfig(input.config)
  } catch {
    blockers.push('verified Monad Safe factory and EntryPoint configuration is required')
  }
  if (!input.ownerAuthorization || !input.ownerAuthorization.cryptographicallyVerified) {
    blockers.push('cryptographically verified owner authorization is required')
  }
  if (!input.sponsorPolicy.persistent || !input.sponsorPolicy.authorized) {
    blockers.push('persistent sponsor policy authorization is required')
  }
  if (!input.userClicked) blockers.push('explicit user activation click is required')
  return Object.freeze({ canConstructUserOperation: blockers.length === 0, blockers: Object.freeze(blockers) })
}
