export interface MonadActivationConfig {
  readonly chainId: 10143
  readonly safeFactory: string
  /** SafeProxyFactory.proxyCreationCode(), read and pinned from Monad Testnet. */
  readonly safeProxyCreationCode: string
  /** Safe 1.4.1 singleton used by the derived single-owner proxy. */
  readonly safeSingleton: string
  /** Safe4337Module v0.3.0 (EntryPoint v0.7) — also used as Safe fallbackHandler. */
  readonly safe4337Module: string
  /** Safe Module Setup / AddModulesLib used during Safe.setup enableModules. */
  readonly safeModuleSetup: string
  readonly entryPoint: string
  readonly luckyDraw: string
  /**
   * Safe7579 / Smart Session product path — archived / superseded by Zodiac Roles.
   * Remains disabled. See `safe7579Readiness.ts` and `rolesReadiness.ts`.
   */
  readonly safe7579SmartSessionEnabled: false
  /**
   * Zodiac Roles session product path. Stack is live on Monad; enable after session tip funding.
   */
  readonly rolesSessionEnabled: true
  /** Canonical Roles mastercopy (multi-chain CREATE2). */
  readonly rolesMasterCopy: string
  /** Zodiac ModuleProxyFactory (multi-chain CREATE2). */
  readonly rolesModuleProxyFactory: string
}

const CHAIN_ID = 10143 as const
const SAFE_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67'
const SAFE_SINGLETON = '0x41675C099F32341bf84BFc5382aF534df5C7461a'
// Returned by eth_call(proxyCreationCode()) on the pinned SafeProxyFactory (includes revert string suffix).
const SAFE_PROXY_CREATION_CODE = '0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea264697066735822122003d1488ee65e08fa41e58e888a9865554c535f2c77126a82cb4c0f917f31441364736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564'
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'
const LUCKY_DRAW = '0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70'
/** permissionless Safe 1.4.1 + EntryPoint 0.7 defaults (verified bytecode on Monad Testnet). */
const SAFE_4337_MODULE = '0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226'
const SAFE_MODULE_SETUP = '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47'
/** Canonical multi-chain Roles addresses — not officially listed for Monad. */
const ROLES_MASTER_COPY = '0x9646fDAD06d3e24444381f44362a3B0eB343D337'
const ROLES_MODULE_PROXY_FACTORY = '0x000000000000aDdB49795b0f9bA5BC298cDda236'
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export const MONAD_ACTIVATION_CONFIG: MonadActivationConfig = Object.freeze({
  chainId: CHAIN_ID,
  safeFactory: SAFE_FACTORY,
  safeProxyCreationCode: SAFE_PROXY_CREATION_CODE,
  safeSingleton: SAFE_SINGLETON,
  safe4337Module: SAFE_4337_MODULE,
  safeModuleSetup: SAFE_MODULE_SETUP,
  entryPoint: ENTRY_POINT_V07,
  luckyDraw: LUCKY_DRAW,
  safe7579SmartSessionEnabled: false,
  rolesSessionEnabled: true,
  rolesMasterCopy: ROLES_MASTER_COPY,
  rolesModuleProxyFactory: ROLES_MODULE_PROXY_FACTORY
})

/** Accept only the audited public endpoints and factory bytecode for this milestone. */
export function createMonadActivationConfig(input: {
  chainId: number
  safeFactory: string
  safeProxyCreationCode?: string
  safeSingleton?: string
  safe4337Module?: string
  safeModuleSetup?: string
  entryPoint: string
  luckyDraw: string
}): MonadActivationConfig {
  if (input.chainId !== CHAIN_ID) throw new Error('Monad Testnet chainId is required')
  for (const [field, value, expected] of [
    ['Safe factory', input.safeFactory, SAFE_FACTORY],
    ['Safe singleton', input.safeSingleton ?? SAFE_SINGLETON, SAFE_SINGLETON],
    ['Safe4337 module', input.safe4337Module ?? SAFE_4337_MODULE, SAFE_4337_MODULE],
    ['Safe module setup', input.safeModuleSetup ?? SAFE_MODULE_SETUP, SAFE_MODULE_SETUP],
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
