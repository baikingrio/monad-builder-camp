import type { EthereumAddress } from './authMessage'

export interface SafeDerivationInput {
  owner: string
  factory: string
  saltNonce: string | bigint
}

/**
 * Validated input for a future Safe SDK/factory derivation.
 * It intentionally contains no claimed counterfactual Safe address.
 */
export interface SafeDerivationRequest {
  readonly kind: 'safe-derivation-request'
  readonly owner: EthereumAddress
  readonly factory: EthereumAddress
  readonly saltNonce: bigint
}

const ETHEREUM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const MAX_UINT256 = (1n << 256n) - 1n

function requireNonZeroAddress(value: string, field: string): EthereumAddress {
  if (!ETHEREUM_ADDRESS.test(value) || value.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(`${field} must be a non-zero 20-byte Ethereum address`)
  }
  return value as EthereumAddress
}

function parseSaltNonce(value: string | bigint): bigint {
  if (typeof value === 'string' && !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error('saltNonce must be an unsigned decimal integer')
  }

  const saltNonce = typeof value === 'bigint' ? value : BigInt(value)
  if (saltNonce < 0n || saltNonce > MAX_UINT256) {
    throw new Error('saltNonce must fit in uint256')
  }
  return saltNonce
}

export function createSafeDerivationRequest(input: SafeDerivationInput): SafeDerivationRequest {
  return {
    kind: 'safe-derivation-request',
    owner: requireNonZeroAddress(input.owner, 'owner'),
    factory: requireNonZeroAddress(input.factory, 'factory'),
    saltNonce: parseSaltNonce(input.saltNonce)
  }
}
