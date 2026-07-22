export interface MonadActivationConfig {
  readonly chainId: 10143
  readonly safeFactory: string
  readonly entryPoint: string
  readonly luckyDraw: string
}

const CHAIN_ID = 10143 as const
const SAFE_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67'
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'
const LUCKY_DRAW = '0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70'
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export const MONAD_ACTIVATION_CONFIG: MonadActivationConfig = Object.freeze({
  chainId: CHAIN_ID,
  safeFactory: SAFE_FACTORY,
  entryPoint: ENTRY_POINT_V07,
  luckyDraw: LUCKY_DRAW
})

/**
 * Accept only the audited public endpoints for the current activation milestone.
 * This is configuration validation, not an RPC code check or Safe derivation.
 */
export function createMonadActivationConfig(input: {
  chainId: number
  safeFactory: string
  entryPoint: string
  luckyDraw: string
}): MonadActivationConfig {
  if (input.chainId !== CHAIN_ID) throw new Error('Monad Testnet chainId is required')
  for (const [field, value, expected] of [
    ['Safe factory', input.safeFactory, SAFE_FACTORY],
    ['EntryPoint', input.entryPoint, ENTRY_POINT_V07],
    ['Lucky Draw', input.luckyDraw, LUCKY_DRAW]
  ] as const) {
    if (!ADDRESS.test(value) || value.toLowerCase() === ZERO_ADDRESS || value.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(`${field} must match the verified Monad Testnet configuration`)
    }
  }
  return Object.freeze({ chainId: CHAIN_ID, safeFactory: SAFE_FACTORY, entryPoint: ENTRY_POINT_V07, luckyDraw: LUCKY_DRAW })
}
