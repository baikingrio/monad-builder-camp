import {
  createPublicClient,
  defineChain,
  http,
  type Address,
  type Hex,
  type PublicClient
} from 'viem'
import { toAccount } from 'viem/accounts'
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction'
import { toSafeSmartAccount } from 'permissionless/accounts'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import {
  assertActivationDrawRequest,
  encodeLuckyDrawCallData,
  serializeUserOperationForClient,
  type ActivationSafeState,
  type UnsignedSponsoredUserOperation
} from '../../app/lib/activationUserOperation'
import { MONAD_ACTIVATION_CONFIG } from '../../app/lib/monadConfig'
import type { LiveExecutionConfig } from './liveExecutionConfig'

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'MonadVision', url: 'https://testnet.monadvision.com' } }
})

export interface PrepareActivationInput {
  readonly owner: string
  readonly safe: ActivationSafeState
  readonly userClicked: boolean
  readonly live: LiveExecutionConfig
  readonly publicClient?: PublicClient
  readonly bundlerUrl?: string
}

function ownerPlaceholder(address: Address) {
  return toAccount({
    address,
    async signMessage() {
      throw new Error('Owner UserOperation signing must happen in the browser wallet')
    },
    async signTransaction() {
      throw new Error('Owner UserOperation signing must happen in the browser wallet')
    },
    async signTypedData() {
      throw new Error('Owner UserOperation signing must happen in the browser wallet')
    }
  })
}

function toHexQuantity(value: bigint): Hex {
  return `0x${value.toString(16)}` as Hex
}

/**
 * Builds and sponsors an unsigned Safe4337 UserOperation for LuckyDraw.draw().
 * Credentials remain in the live config closure and are never returned.
 */
export async function prepareSponsoredActivation(input: PrepareActivationInput): Promise<{
  readonly safe: string
  readonly entryPoint: string
  readonly userOperation: UnsignedSponsoredUserOperation
}> {
  const prepared = assertActivationDrawRequest({
    owner: input.owner,
    safe: input.safe,
    userClicked: input.userClicked,
    config: MONAD_ACTIVATION_CONFIG
  })

  const publicClient = input.publicClient ?? createPublicClient({
    chain: monadTestnet,
    transport: http(input.live.rpcUrl)
  })
  const bundlerUrl = input.bundlerUrl ?? input.live.createBundlerUrl()
  const pimlico = createPimlicoClient({
    transport: http(bundlerUrl),
    entryPoint: { address: entryPoint07Address, version: '0.7' }
  })

  const account = await toSafeSmartAccount({
    client: publicClient,
    owners: [ownerPlaceholder(prepared.owner as Address)],
    version: '1.4.1',
    entryPoint: { address: MONAD_ACTIVATION_CONFIG.entryPoint as Address, version: '0.7' },
    safe4337ModuleAddress: input.live.safe4337Module,
    safeModuleSetupAddress: MONAD_ACTIVATION_CONFIG.safeModuleSetup as Address,
    safeProxyFactoryAddress: MONAD_ACTIVATION_CONFIG.safeFactory as Address,
    safeSingletonAddress: MONAD_ACTIVATION_CONFIG.safeSingleton as Address,
    saltNonce: 0n,
    // Match our pinned CREATE2 initializer (direct enableModules, not MultiSend-wrapped).
    useMultiSendForSetup: false
  })

  if (account.address.toLowerCase() !== prepared.safeAddress.toLowerCase()) {
    throw new Error('permissionless Safe address does not match pinned counterfactual derivation')
  }

  const callData = await account.encodeCalls([{
    to: prepared.call.to,
    value: prepared.call.value,
    data: encodeLuckyDrawCallData()
  }])
  const nonce = await account.getNonce()
  const factoryArgs = prepared.needsDeployment ? await account.getFactoryArgs() : undefined
  const gasPrice = await pimlico.getUserOperationGasPrice()
  const stubSignature = await account.getStubSignature()

  const sponsored = await pimlico.sponsorUserOperation({
    userOperation: {
      sender: account.address,
      nonce,
      factory: factoryArgs?.factory,
      factoryData: factoryArgs?.factoryData,
      callData,
      maxFeePerGas: gasPrice.fast.maxFeePerGas,
      maxPriorityFeePerGas: gasPrice.fast.maxPriorityFeePerGas,
      signature: stubSignature
    },
    entryPoint: { address: entryPoint07Address, version: '0.7' }
  })

  const userOperation = serializeUserOperationForClient({
    sender: account.address,
    nonce: toHexQuantity(nonce),
    factory: factoryArgs?.factory,
    factoryData: factoryArgs?.factoryData,
    callData,
    callGasLimit: toHexQuantity(sponsored.callGasLimit),
    verificationGasLimit: toHexQuantity(sponsored.verificationGasLimit),
    preVerificationGas: toHexQuantity(sponsored.preVerificationGas),
    maxFeePerGas: toHexQuantity(gasPrice.fast.maxFeePerGas),
    maxPriorityFeePerGas: toHexQuantity(gasPrice.fast.maxPriorityFeePerGas),
    paymaster: sponsored.paymaster,
    paymasterVerificationGasLimit: toHexQuantity(sponsored.paymasterVerificationGasLimit),
    paymasterPostOpGasLimit: toHexQuantity(sponsored.paymasterPostOpGasLimit),
    paymasterData: sponsored.paymasterData,
    signature: '0x'
  })

  const gasBudget = BigInt(userOperation.callGasLimit)
    + BigInt(userOperation.verificationGasLimit)
    + BigInt(userOperation.preVerificationGas)
    + BigInt(userOperation.paymasterVerificationGasLimit)
    + BigInt(userOperation.paymasterPostOpGasLimit)
  if (gasBudget > input.live.maxGas) {
    throw new Error(`sponsored user operation exceeds configured max gas (needed ${gasBudget.toString()}, max ${input.live.maxGas.toString()})`)
  }

  return Object.freeze({
    safe: account.address,
    entryPoint: MONAD_ACTIVATION_CONFIG.entryPoint,
    userOperation
  })
}

export async function submitSponsoredUserOperation(input: {
  readonly live: LiveExecutionConfig
  readonly userOperation: Record<string, unknown>
  readonly bundlerUrl?: string
}): Promise<{ readonly userOpHash: Hex; readonly receipt?: { readonly success: boolean; readonly txHash?: Hex } }> {
  const bundlerUrl = input.bundlerUrl ?? input.live.createBundlerUrl()
  const bundler = createBundlerClient({
    transport: http(bundlerUrl),
    chain: monadTestnet
  })

  const raw = input.userOperation
  const userOperation = {
    sender: raw.sender as Address,
    nonce: BigInt(String(raw.nonce)),
    factory: raw.factory as Address | undefined,
    factoryData: raw.factoryData as Hex | undefined,
    callData: raw.callData as Hex,
    callGasLimit: BigInt(String(raw.callGasLimit)),
    verificationGasLimit: BigInt(String(raw.verificationGasLimit)),
    preVerificationGas: BigInt(String(raw.preVerificationGas)),
    maxFeePerGas: BigInt(String(raw.maxFeePerGas)),
    maxPriorityFeePerGas: BigInt(String(raw.maxPriorityFeePerGas)),
    paymaster: raw.paymaster as Address,
    paymasterVerificationGasLimit: BigInt(String(raw.paymasterVerificationGasLimit ?? '0x0')),
    paymasterPostOpGasLimit: BigInt(String(raw.paymasterPostOpGasLimit ?? '0x0')),
    paymasterData: (raw.paymasterData as Hex) ?? '0x',
    signature: raw.signature as Hex
  }

  const userOpHash = await bundler.sendUserOperation({
    entryPointAddress: entryPoint07Address,
    ...userOperation
  })

  const receipt = await bundler.waitForUserOperationReceipt({ hash: userOpHash, timeout: 120_000 })
  return {
    userOpHash,
    receipt: {
      success: receipt.success,
      txHash: receipt.receipt.transactionHash
    }
  }
}
