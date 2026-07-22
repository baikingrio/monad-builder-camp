import { concat, encodeFunctionData, getAddress, getCreate2Address, keccak256, pad, toHex, type Address, type Hex } from 'viem'
import type { EthereumAddress } from './authMessage'
import { createMonadActivationConfig, type MonadActivationConfig } from './monadConfig'

export interface SafeDerivationInput { owner: string; factory: string; saltNonce: string | bigint }
export interface SafeDerivationRequest {
  readonly kind: 'safe-derivation-request'
  readonly owner: EthereumAddress
  readonly factory: EthereumAddress
  readonly saltNonce: bigint
}
export interface CounterfactualSafe {
  readonly kind: 'counterfactual-safe'
  readonly address: EthereumAddress
  readonly owner: EthereumAddress
  readonly threshold: 1
  readonly saltNonce: bigint
  readonly initializer: Hex
  /** Pure derivation; this makes no RPC call and cannot establish deployed code. */
  readonly deployment: 'counterfactual-not-deployed'
}

const ETHEREUM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const MAX_UINT256 = (1n << 256n) - 1n

function requireNonZeroAddress(value: string, field: string): EthereumAddress {
  if (!ETHEREUM_ADDRESS.test(value) || value.toLowerCase() === ZERO_ADDRESS) throw new Error(`${field} must be a non-zero 20-byte Ethereum address`)
  return value as EthereumAddress
}
function parseSaltNonce(value: string | bigint): bigint {
  if (typeof value === 'string' && !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('saltNonce must be an unsigned decimal integer')
  const saltNonce = typeof value === 'bigint' ? value : BigInt(value)
  if (saltNonce < 0n || saltNonce > MAX_UINT256) throw new Error('saltNonce must fit in uint256')
  return saltNonce
}
export function createSafeDerivationRequest(input: SafeDerivationInput): SafeDerivationRequest {
  return { kind: 'safe-derivation-request', owner: requireNonZeroAddress(input.owner, 'owner'), factory: requireNonZeroAddress(input.factory, 'factory'), saltNonce: parseSaltNonce(input.saltNonce) }
}

const SAFE_SETUP_ABI = [{ type: 'function', name: 'setup', stateMutability: 'nonpayable', inputs: [
  { name: '_owners', type: 'address[]' }, { name: '_threshold', type: 'uint256' }, { name: 'to', type: 'address' }, { name: 'data', type: 'bytes' },
  { name: 'fallbackHandler', type: 'address' }, { name: 'paymentToken', type: 'address' }, { name: 'payment', type: 'uint256' }, { name: 'paymentReceiver', type: 'address' }
], outputs: [] }] as const
const EMPTY_ADDRESS = ZERO_ADDRESS as Address

/** Exact SafeProxyFactory createProxyWithNonce CREATE2 calculation. */
export function deriveSafeCreate2Address(input: { factory: string; proxyCreationCode: string; singleton: string; initializer: Hex; saltNonce: string | bigint }): EthereumAddress {
  const request = createSafeDerivationRequest({ owner: input.singleton, factory: input.factory, saltNonce: input.saltNonce })
  if (!/^0x(?:[a-fA-F0-9]{2})+$/.test(input.proxyCreationCode)) throw new Error('proxyCreationCode must be hex bytecode')
  const salt = keccak256(concat([keccak256(input.initializer), pad(toHex(request.saltNonce), { size: 32 })]))
  const bytecodeHash = keccak256(concat([input.proxyCreationCode as Hex, pad(request.owner as Address, { size: 32 })]))
  return getAddress(getCreate2Address({ from: request.factory as Address, salt, bytecodeHash })) as EthereumAddress
}

/** Pure, offline Safe 1.4.1 derivation for exactly one authenticated EOA owner. */
export function deriveMonadCounterfactualSafe(input: { owner: string; config: MonadActivationConfig; saltNonce?: string | bigint }): CounterfactualSafe {
  const config = createMonadActivationConfig(input.config)
  const request = createSafeDerivationRequest({ owner: input.owner, factory: config.safeFactory, saltNonce: input.saltNonce ?? 0n })
  const initializer = encodeFunctionData({ abi: SAFE_SETUP_ABI, functionName: 'setup', args: [[request.owner as Address], 1n, EMPTY_ADDRESS, '0x', EMPTY_ADDRESS, EMPTY_ADDRESS, 0n, EMPTY_ADDRESS] })
  return Object.freeze({
    kind: 'counterfactual-safe',
    address: deriveSafeCreate2Address({ factory: config.safeFactory, proxyCreationCode: config.safeProxyCreationCode, singleton: config.safeSingleton, initializer, saltNonce: request.saltNonce }),
    owner: request.owner, threshold: 1, saltNonce: request.saltNonce, initializer, deployment: 'counterfactual-not-deployed'
  })
}
