import { encodeFunctionData, type Address, type Hex } from 'viem'
import { createMonadActivationConfig, type MonadActivationConfig } from './monadConfig'
import { deriveMonadCounterfactualSafe } from './safeAddress'

/** ABI selector for the sole permitted LuckyDraw.draw() call. */
export const LUCKY_DRAW_DRAW_SELECTOR = '0x35d1193c' as const

export interface ConfirmedCounterfactualSafeState {
  readonly address: string
  readonly owner: string
  readonly derivationVerified: true
  /** This preparation is exclusively for activation of a counterfactual Safe. */
  readonly deploymentStatus: 'not-deployed'
  readonly safeDeployed: false
}

/** ERC-4337 v0.7 packed UserOperation shape. It is unsigned and has no paymaster fields. */
export interface UserOperationV07SimulationRequest {
  readonly entryPoint: string
  readonly userOperation: Readonly<{
    sender: string
    nonce: Hex
    factory: string
    factoryData: Hex
    callData: typeof LUCKY_DRAW_DRAW_SELECTOR
    callGasLimit: Hex
    verificationGasLimit: Hex
    preVerificationGas: Hex
    maxFeePerGas: Hex
    maxPriorityFeePerGas: Hex
    paymaster: null
    paymasterVerificationGasLimit: null
    paymasterPostOpGasLimit: null
    paymasterData: null
    signature: '0x'
  }>
}

export interface FixedSimulationPreparation {
  readonly kind: 'fixed-v07-activation-draw-simulation-preparation'
  readonly chainId: 10143
  readonly owner: string
  readonly safe: string
  readonly target: string
  readonly value: 0n
  readonly drawSelector: typeof LUCKY_DRAW_DRAW_SELECTOR
  readonly simulation: UserOperationV07SimulationRequest
}

export interface SimulationPreparationInput {
  readonly config: MonadActivationConfig
  /** Identity comes from the verified login/session boundary, never a UserOp signature. */
  readonly ownerAuthorization?: Readonly<{ owner: string; cryptographicallyVerified: boolean }>
  readonly safe?: ConfirmedCounterfactualSafeState
  /** Must be set only by the explicit simulation-preview control. */
  readonly userClicked: boolean
}

export interface SimulationPreparationOverrides {
  readonly target?: string
  readonly value?: bigint
  readonly callData?: string
  readonly entryPoint?: string
  readonly factory?: string
  readonly sender?: string
}

const FACTORY_ABI = [{ type: 'function', name: 'createProxyWithNonce', stateMutability: 'nonpayable', inputs: [
  { name: '_singleton', type: 'address' }, { name: 'initializer', type: 'bytes' }, { name: 'saltNonce', type: 'uint256' }
], outputs: [{ name: 'proxy', type: 'address' }] }] as const

function requireFixed(value: unknown, expected: unknown, message: string): void {
  if (typeof value === 'string' && typeof expected === 'string' ? value.toLowerCase() !== expected.toLowerCase() : value !== expected) throw new Error(message)
}

/**
 * Pure preparation only. It cannot sign, estimate gas, contact a Bundler, invoke
 * a Paymaster/Sponsor, deploy a Safe, submit a UserOperation, or broadcast.
 */
export function createFixedV07SimulationPreparation(input: SimulationPreparationInput, overrides: SimulationPreparationOverrides = {}): FixedSimulationPreparation {
  const config = createMonadActivationConfig(input.config)
  if (!input.userClicked) throw new Error('explicit user simulation-preview click is required')
  if (!input.ownerAuthorization?.cryptographicallyVerified) throw new Error('cryptographically verified EOA authentication is required')
  const ownerAuthorization = input.ownerAuthorization
  if (!/^0x[a-fA-F0-9]{40}$/.test(ownerAuthorization.owner)) throw new Error('authenticated EOA must be a 20-byte Ethereum address')
  if (!input.safe || input.safe.derivationVerified !== true) throw new Error('verified counterfactual Safe derivation is required')
  if (input.safe.deploymentStatus !== 'not-deployed' || input.safe.safeDeployed !== false) throw new Error('counterfactual Safe must be confirmed not deployed')
  requireFixed(input.safe.owner, ownerAuthorization.owner, 'Safe owner must match the authenticated EOA')

  const derived = deriveMonadCounterfactualSafe({ owner: ownerAuthorization.owner, config, saltNonce: 0n })
  requireFixed(input.safe.address, derived.address, 'Safe address must match the verified counterfactual derivation')
  requireFixed(overrides.target ?? config.luckyDraw, config.luckyDraw, 'simulation requires the fixed Lucky Draw target')
  requireFixed(overrides.value ?? 0n, 0n, 'simulation requires zero value')
  requireFixed(overrides.callData ?? LUCKY_DRAW_DRAW_SELECTOR, LUCKY_DRAW_DRAW_SELECTOR, 'simulation requires the fixed Lucky Draw draw selector')
  requireFixed(overrides.entryPoint ?? config.entryPoint, config.entryPoint, 'simulation requires the verified EntryPoint')
  requireFixed(overrides.factory ?? config.safeFactory, config.safeFactory, 'simulation requires the verified Safe factory')
  requireFixed(overrides.sender ?? derived.address, derived.address, 'simulation sender must be the verified counterfactual Safe')

  const factoryData = encodeFunctionData({ abi: FACTORY_ABI, functionName: 'createProxyWithNonce', args: [config.safeSingleton as Address, derived.initializer, 0n] })
  return Object.freeze({
    kind: 'fixed-v07-activation-draw-simulation-preparation', chainId: config.chainId,
    owner: ownerAuthorization.owner, safe: derived.address, target: config.luckyDraw, value: 0n, drawSelector: LUCKY_DRAW_DRAW_SELECTOR,
    simulation: Object.freeze({
      entryPoint: config.entryPoint,
      userOperation: Object.freeze({ sender: derived.address, nonce: '0x0', factory: config.safeFactory, factoryData, callData: LUCKY_DRAW_DRAW_SELECTOR, callGasLimit: '0x0', verificationGasLimit: '0x0', preVerificationGas: '0x0', maxFeePerGas: '0x0', maxPriorityFeePerGas: '0x0', paymaster: null, paymasterVerificationGasLimit: null, paymasterPostOpGasLimit: null, paymasterData: null, signature: '0x' })
    })
  })
}
