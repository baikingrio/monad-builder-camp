import { encodeFunctionData, type Address, type Hex } from 'viem'
import { MONAD_ACTIVATION_CONFIG, createMonadActivationConfig, type MonadActivationConfig } from './monadConfig'
import { deriveMonadCounterfactualSafe } from './safeAddress'
import { LUCKY_DRAW_DRAW_SELECTOR } from './userOperationSimulation'

export { LUCKY_DRAW_DRAW_SELECTOR }

/** ABI used by Safe4337Module executeUserOp / encodeCalls path validation. */
export const DRAW_CALL = Object.freeze({
  to: MONAD_ACTIVATION_CONFIG.luckyDraw as Address,
  value: 0n,
  data: LUCKY_DRAW_DRAW_SELECTOR as Hex
})

export interface ActivationSafeState {
  readonly address: string
  readonly owner: string
  readonly derivationVerified: true
  readonly deploymentStatus: 'not-deployed' | 'deployed'
  readonly safeDeployed: boolean
}

export interface ActivationBuildInput {
  readonly config?: MonadActivationConfig
  readonly owner: string
  readonly safe: ActivationSafeState
  readonly userClicked: boolean
}

export interface UnsignedUserOperation {
  readonly sender: string
  readonly nonce: Hex
  readonly factory?: string
  readonly factoryData?: Hex
  readonly callData: Hex
  readonly callGasLimit: Hex
  readonly verificationGasLimit: Hex
  readonly preVerificationGas: Hex
  readonly maxFeePerGas: Hex
  readonly maxPriorityFeePerGas: Hex
  /** Absent (not zero-filled) when gas is paid from EntryPoint.balanceOf(sender). */
  readonly paymaster?: string
  readonly paymasterVerificationGasLimit?: Hex
  readonly paymasterPostOpGasLimit?: Hex
  readonly paymasterData?: Hex
  readonly signature: '0x'
}

export interface UnsignedSponsoredUserOperation extends UnsignedUserOperation {
  readonly paymaster: string
  readonly paymasterVerificationGasLimit: Hex
  readonly paymasterPostOpGasLimit: Hex
  readonly paymasterData: Hex
}

/**
 * Validates the only permitted activation/draw call before any Bundler/Paymaster contact.
 * Pure gate: does not sign, sponsor, or broadcast.
 */
export function assertActivationDrawRequest(input: ActivationBuildInput): {
  readonly config: MonadActivationConfig
  readonly safeAddress: string
  readonly owner: string
  readonly needsDeployment: boolean
  readonly call: typeof DRAW_CALL
} {
  if (!input.userClicked) throw new Error('explicit user activation click is required')
  const config = createMonadActivationConfig(input.config ?? MONAD_ACTIVATION_CONFIG)
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.owner)) throw new Error('owner must be a 20-byte Ethereum address')
  if (!input.safe.derivationVerified) throw new Error('verified counterfactual Safe derivation is required')
  if (input.safe.owner.toLowerCase() !== input.owner.toLowerCase()) throw new Error('Safe owner must match the authenticated EOA')

  const derived = deriveMonadCounterfactualSafe({ owner: input.owner, config, saltNonce: 0n })
  if (input.safe.address.toLowerCase() !== derived.address.toLowerCase()) {
    throw new Error('Safe address must match the verified counterfactual derivation')
  }

  const needsDeployment = input.safe.deploymentStatus === 'not-deployed'
  if (needsDeployment && input.safe.safeDeployed) throw new Error('counterfactual Safe must be confirmed not deployed')
  if (!needsDeployment && input.safe.deploymentStatus !== 'deployed') throw new Error('Safe deployment status is required')

  return Object.freeze({
    config,
    safeAddress: derived.address,
    owner: input.owner,
    needsDeployment,
    call: DRAW_CALL
  })
}

/** Encode the sole LuckyDraw.draw() call for Safe execution. */
export function encodeLuckyDrawCallData(): Hex {
  return encodeFunctionData({
    abi: [{ type: 'function', name: 'draw', stateMutability: 'nonpayable', inputs: [], outputs: [] }],
    functionName: 'draw'
  })
}

export function serializeUserOperationForClient<T extends UnsignedUserOperation>(userOp: T): T {
  const json = JSON.stringify(userOp)
  if (/pimlico|apikey|private|secret/i.test(json)) throw new Error('user operation payload must not include credentials')
  if (userOp.signature !== '0x') throw new Error('prepared UserOperation must remain unsigned for browser signing')
  return Object.freeze({ ...userOp })
}
