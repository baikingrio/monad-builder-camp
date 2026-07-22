export interface MonadActivationConfig {
  readonly chainId: 10143
  readonly safeFactory: string
  /** SafeProxyFactory.proxyCreationCode(), read and pinned from Monad Testnet. */
  readonly safeProxyCreationCode: string
  /** Safe 1.4.1 singleton used by the derived single-owner proxy. */
  readonly safeSingleton: string
  readonly entryPoint: string
  readonly luckyDraw: string
}

const CHAIN_ID = 10143 as const
const SAFE_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67'
const SAFE_SINGLETON = '0x41675C099F32341bf84BFc5382aF534df5C7461a'
// Returned by eth_call(proxyCreationCode()) on the pinned SafeProxyFactory above.
const SAFE_PROXY_CREATION_CODE = '0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea264697066735822122003d1488ee65e08fa41e58e888a9865554c535f2c77126a82cb4c0f917f31441364736f6c63430007060033'
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'
const LUCKY_DRAW = '0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70'
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export const MONAD_ACTIVATION_CONFIG: MonadActivationConfig = Object.freeze({
  chainId: CHAIN_ID,
  safeFactory: SAFE_FACTORY,
  safeProxyCreationCode: SAFE_PROXY_CREATION_CODE,
  safeSingleton: SAFE_SINGLETON,
  entryPoint: ENTRY_POINT_V07,
  luckyDraw: LUCKY_DRAW
})

/** Accept only the audited public endpoints and factory bytecode for this milestone. */
export function createMonadActivationConfig(input: {
  chainId: number
  safeFactory: string
  safeProxyCreationCode?: string
  safeSingleton?: string
  entryPoint: string
  luckyDraw: string
}): MonadActivationConfig {
  if (input.chainId !== CHAIN_ID) throw new Error('Monad Testnet chainId is required')
  for (const [field, value, expected] of [
    ['Safe factory', input.safeFactory, SAFE_FACTORY],
    ['Safe singleton', input.safeSingleton ?? SAFE_SINGLETON, SAFE_SINGLETON],
    ['EntryPoint', input.entryPoint, ENTRY_POINT_V07],
    ['Lucky Draw', input.luckyDraw, LUCKY_DRAW]
  ] as const) {
    if (!ADDRESS.test(value) || value.toLowerCase() === ZERO_ADDRESS || value.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(`${field} must match the verified Monad Testnet configuration`)
    }
  }
  if (input.safeProxyCreationCode !== undefined && input.safeProxyCreationCode !== SAFE_PROXY_CREATION_CODE) {
    throw new Error('Safe proxy creation code must match the verified Monad Testnet configuration')
  }
  return MONAD_ACTIVATION_CONFIG
}
