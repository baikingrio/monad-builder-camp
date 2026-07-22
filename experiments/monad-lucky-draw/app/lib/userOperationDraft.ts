import { evaluateActivationReadiness, type ActivationReadinessInput } from './activationReadiness'
import { createMonadActivationConfig } from './monadConfig'

/** ABI selector for MonadLuckyDraw.draw(); immutable for this milestone. */
export const LUCKY_DRAW_CALLDATA = '0x0eecae21' as const

export interface ActivationSimulationDraft {
  readonly kind: 'activation-simulation-draft'
  readonly chainId: 10143
  readonly owner: string
  readonly safeFactory: string
  readonly entryPoint: string
  readonly target: string
  readonly value: 0n
  readonly callData: typeof LUCKY_DRAW_CALLDATA
}

export interface DraftOverrides {
  readonly callData?: string
  readonly value?: bigint
}

/**
 * Produces a serializable, non-signable simulation draft only. It contains no
 * UserOperation signature, RPC client, paymaster call, or broadcast capability.
 */
export function createActivationSimulationDraft(
  input: ActivationReadinessInput,
  overrides: DraftOverrides = {}
): ActivationSimulationDraft {
  const readiness = evaluateActivationReadiness(input)
  if (!readiness.canConstructUserOperation) throw new Error(`activation is not ready: ${readiness.blockers.join('; ')}`)
  const config = createMonadActivationConfig(input.config)
  if (overrides.callData !== undefined && overrides.callData !== LUCKY_DRAW_CALLDATA) {
    throw new Error('activation requires fixed Lucky Draw calldata')
  }
  if (overrides.value !== undefined && overrides.value !== 0n) throw new Error('activation requires zero value')
  const owner = input.ownerAuthorization?.owner
  if (!owner) throw new Error('activation is not ready: verified owner authorization is required')
  return Object.freeze({
    kind: 'activation-simulation-draft',
    chainId: config.chainId,
    owner,
    safeFactory: config.safeFactory,
    entryPoint: config.entryPoint,
    target: config.luckyDraw,
    value: 0n,
    callData: LUCKY_DRAW_CALLDATA
  })
}
