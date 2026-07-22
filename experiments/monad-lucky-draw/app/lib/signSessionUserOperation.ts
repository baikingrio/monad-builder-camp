import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Address,
  type Hex
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { toSafeSmartAccount } from 'permissionless/accounts'
import { MONAD_ACTIVATION_CONFIG } from './monadConfig'
import type { UnsignedSponsoredUserOperation } from './activationUserOperation'
import { toSignableUserOperation } from './signActivationUserOperation'

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
})

/** Owner wallet signs the one-time session-enable UserOperation. */
export async function signWithOwnerWallet(input: {
  readonly owner: Address
  readonly ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
  readonly safe: Address
  readonly userOperation: UnsignedSponsoredUserOperation
}): Promise<Hex> {
  const walletClient = createWalletClient({
    account: input.owner,
    chain: monadTestnet,
    transport: custom(input.ethereum)
  })
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http('https://testnet-rpc.monad.xyz')
  })
  const account = await toSafeSmartAccount({
    client: publicClient,
    address: input.safe,
    owners: [walletClient],
    version: '1.4.1',
    entryPoint: { address: MONAD_ACTIVATION_CONFIG.entryPoint as Address, version: '0.7' },
    safe4337ModuleAddress: MONAD_ACTIVATION_CONFIG.safe4337Module as Address,
    safeModuleSetupAddress: MONAD_ACTIVATION_CONFIG.safeModuleSetup as Address,
    safeProxyFactoryAddress: MONAD_ACTIVATION_CONFIG.safeFactory as Address,
    safeSingletonAddress: MONAD_ACTIVATION_CONFIG.safeSingleton as Address,
    saltNonce: 0n,
    useMultiSendForSetup: false
  })
  return account.signUserOperation(toSignableUserOperation(input.userOperation))
}

/** Session private key signs a draw UserOperation with no wallet popup. */
export async function signWithSessionKey(input: {
  readonly privateKey: `0x${string}`
  readonly safe: Address
  readonly userOperation: UnsignedSponsoredUserOperation
}): Promise<Hex> {
  const sessionAccount = privateKeyToAccount(input.privateKey)
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http('https://testnet-rpc.monad.xyz')
  })
  const account = await toSafeSmartAccount({
    client: publicClient,
    address: input.safe,
    owners: [sessionAccount],
    version: '1.4.1',
    entryPoint: { address: MONAD_ACTIVATION_CONFIG.entryPoint as Address, version: '0.7' },
    safe4337ModuleAddress: MONAD_ACTIVATION_CONFIG.safe4337Module as Address,
    safeModuleSetupAddress: MONAD_ACTIVATION_CONFIG.safeModuleSetup as Address,
    safeProxyFactoryAddress: MONAD_ACTIVATION_CONFIG.safeFactory as Address,
    safeSingletonAddress: MONAD_ACTIVATION_CONFIG.safeSingleton as Address,
    saltNonce: 0n,
    useMultiSendForSetup: false
  })
  return account.signUserOperation(toSignableUserOperation(input.userOperation))
}
