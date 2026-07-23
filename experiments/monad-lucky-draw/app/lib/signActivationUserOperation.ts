import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Hex,
  type Address
} from 'viem'
import { toSafeSmartAccount } from 'permissionless/accounts'
import { MONAD_ACTIVATION_CONFIG } from './monadConfig'
import type { UnsignedSponsoredUserOperation, UnsignedUserOperation } from './activationUserOperation'

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
})

function qty(value: string): bigint {
  return BigInt(value)
}

/** Convert the server-sponsored hex UserOperation into the bigint shape Safe signing expects. */
export function toSignableUserOperation(userOp: UnsignedUserOperation) {
  return {
    sender: userOp.sender as Address,
    nonce: qty(userOp.nonce),
    factory: userOp.factory as Address | undefined,
    factoryData: userOp.factoryData,
    callData: userOp.callData,
    callGasLimit: qty(userOp.callGasLimit),
    verificationGasLimit: qty(userOp.verificationGasLimit),
    preVerificationGas: qty(userOp.preVerificationGas),
    maxFeePerGas: qty(userOp.maxFeePerGas),
    maxPriorityFeePerGas: qty(userOp.maxPriorityFeePerGas),
    ...(userOp.paymaster ? {
      paymaster: userOp.paymaster as Address,
      paymasterVerificationGasLimit: qty(userOp.paymasterVerificationGasLimit!),
      paymasterPostOpGasLimit: qty(userOp.paymasterPostOpGasLimit!),
      paymasterData: userOp.paymasterData!
    } : {}),
    signature: '0x' as Hex
  }
}

/**
 * Requests one Owner signature for the sponsored UserOperation.
 * This is the chain AA authorization step — distinct from the EIP-191 login message.
 */
export async function signActivationUserOperation(input: {
  readonly owner: Address
  readonly ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
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
