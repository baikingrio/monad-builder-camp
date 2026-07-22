export type EthereumAddress = `0x${string}`

export interface LoginMessageInput {
  eoa: string
  nonce: string
  origin: string
  issuedAt: string
  expiresAt: string
}

export interface LoginMessage {
  readonly type: 'eoa-login-binding'
  readonly eoa: EthereumAddress
  readonly nonce: string
  readonly origin: string
  readonly issuedAt: string
  readonly expiresAt: string
  readonly text: string
}

const ETHEREUM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const NONCE = /^[\x21-\x7e]{16,128}$/

function requireAddress(value: string, field: string): EthereumAddress {
  if (!ETHEREUM_ADDRESS.test(value)) {
    throw new Error(`${field} must be a 20-byte Ethereum address`)
  }

  return value as EthereumAddress
}

function requireOrigin(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('origin must be a valid HTTP(S) origin')
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value) {
    throw new Error('origin must be an exact HTTP(S) origin')
  }

  return value
}

const CANONICAL_UTC_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function requireInstant(value: string, field: string): number {
  if (!CANONICAL_UTC_MILLISECONDS.test(value)) {
    throw new Error(`${field} must be a canonical UTC RFC3339 millisecond timestamp`)
  }

  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(`${field} must be a canonical UTC RFC3339 millisecond timestamp`)
  }
  return timestamp
}

/**
 * Creates text for an EOA authentication and account-binding signature only.
 * This deliberately contains no transaction, Safe, or UserOperation authority.
 */
export function buildLoginMessage(input: LoginMessageInput): LoginMessage {
  const eoa = requireAddress(input.eoa, 'eoa')
  if (!NONCE.test(input.nonce)) {
    throw new Error('nonce must be 16-128 visible ASCII characters')
  }
  const origin = requireOrigin(input.origin)
  const issuedAt = requireInstant(input.issuedAt, 'issuedAt')
  const expiresAt = requireInstant(input.expiresAt, 'expiresAt')
  if (expiresAt <= issuedAt) {
    throw new Error('expiresAt must be after issuedAt')
  }

  return {
    type: 'eoa-login-binding',
    eoa,
    nonce: input.nonce,
    origin,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    text: [
      'Monad Lucky Draw EOA Login',
      '',
      'This signature is for authentication and account binding only.',
      'It does not authorize a Safe, UserOperation, transaction, contract call, or transfer.',
      '',
      `EOA: ${eoa}`,
      `Nonce: ${input.nonce}`,
      `Origin: ${origin}`,
      `Issued At: ${input.issuedAt}`,
      `Expires At: ${input.expiresAt}`
    ].join('\n')
  }
}

export const createLoginMessage = buildLoginMessage
