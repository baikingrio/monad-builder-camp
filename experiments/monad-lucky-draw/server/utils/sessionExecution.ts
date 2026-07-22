import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  http,
  type Address,
  type Hex
} from 'viem'
import { privateKeyToAccount, toAccount } from 'viem/accounts'
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction'
import { toSafeSmartAccount } from 'permissionless/accounts'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import {
  encodeLuckyDrawCallData,
  serializeUserOperationForClient,
  type UnsignedSponsoredUserOperation
} from '../../app/lib/activationUserOperation'
import { MONAD_ACTIVATION_CONFIG } from '../../app/lib/monadConfig'
import { evaluateSessionKeyDraw } from '../../app/lib/sessionKeyPolicy'
import { LUCKY_DRAW_DRAW_SELECTOR } from '../../app/lib/userOperationSimulation'
import type { LiveExecutionConfig } from './liveExecutionConfig'
import type { SessionGrantRecord } from './sessionKeyStore'

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
})

const ADD_OWNER_ABI = [{
  type: 'function',
  name: 'addOwnerWithThreshold',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'owner', type: 'address' },
    { name: '_threshold', type: 'uint256' }
  ],
  outputs: []
}] as const

function toHexQuantity(value: bigint): Hex {
  return `0x${value.toString(16)}` as Hex
}

function signerPlaceholder(address: Address) {
  return toAccount({
    address,
    async signMessage() { throw new Error('signing happens in the browser') },
    async signTransaction() { throw new Error('signing happens in the browser') },
    async signTypedData() { throw new Error('signing happens in the browser') }
  })
}

async function sponsorSafeCalls(input: {
  readonly live: LiveExecutionConfig
  readonly safe: Address
  readonly signerAddress: Address
  readonly calls: readonly { to: Address; value: bigint; data: Hex }[]
}): Promise<{ readonly userOperation: UnsignedSponsoredUserOperation; readonly entryPoint: string }> {
  const publicClient = createPublicClient({ chain: monadTestnet, transport: http(input.live.rpcUrl) })
  const bundlerUrl = input.live.createBundlerUrl()
  const pimlico = createPimlicoClient({
    transport: http(bundlerUrl),
    entryPoint: { address: entryPoint07Address, version: '0.7' }
  })
  const account = await toSafeSmartAccount({
    client: publicClient,
    address: input.safe,
    owners: [signerPlaceholder(input.signerAddress)],
    version: '1.4.1',
    entryPoint: { address: MONAD_ACTIVATION_CONFIG.entryPoint as Address, version: '0.7' },
    safe4337ModuleAddress: input.live.safe4337Module,
    safeModuleSetupAddress: MONAD_ACTIVATION_CONFIG.safeModuleSetup as Address,
    safeProxyFactoryAddress: MONAD_ACTIVATION_CONFIG.safeFactory as Address,
    safeSingletonAddress: MONAD_ACTIVATION_CONFIG.safeSingleton as Address,
    saltNonce: 0n,
    useMultiSendForSetup: false
  })

  const callData = await account.encodeCalls([...input.calls])
  const nonce = await account.getNonce()
  const gasPrice = await pimlico.getUserOperationGasPrice()
  const stubSignature = await account.getStubSignature()
  const sponsored = await pimlico.sponsorUserOperation({
    userOperation: {
      sender: account.address,
      nonce,
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

  return { userOperation, entryPoint: MONAD_ACTIVATION_CONFIG.entryPoint }
}

/** Owner-signed UserOp that adds the session key as a Safe owner (threshold stays 1). */
export async function prepareSessionEnableUserOperation(input: {
  readonly live: LiveExecutionConfig
  readonly owner: Address
  readonly safe: Address
  readonly sessionAddress: Address
}) {
  const data = encodeFunctionData({
    abi: ADD_OWNER_ABI,
    functionName: 'addOwnerWithThreshold',
    args: [input.sessionAddress, 1n]
  })
  return sponsorSafeCalls({
    live: input.live,
    safe: input.safe,
    signerAddress: input.owner,
    calls: [{ to: input.safe, value: 0n, data }]
  })
}

/** Session-key-signed UserOp that only calls LuckyDraw.draw(). */
export async function prepareSessionDrawUserOperation(input: {
  readonly live: LiveExecutionConfig
  readonly grant: SessionGrantRecord
  readonly now: number
}) {
  const decision = evaluateSessionKeyDraw({
    grant: {
      eoa: input.grant.eoa,
      safe: input.grant.safe,
      sessionAddress: input.grant.sessionAddress,
      expiresAt: input.grant.expiresAt,
      remainingCalls: input.grant.remainingCalls,
      onchainAuthorized: input.grant.status === 'active'
    },
    target: MONAD_ACTIVATION_CONFIG.luckyDraw,
    selector: LUCKY_DRAW_DRAW_SELECTOR,
    value: 0n,
    now: input.now
  })
  if (!decision.allowed) throw new Error(decision.reason)

  return sponsorSafeCalls({
    live: input.live,
    safe: input.grant.safe as Address,
    signerAddress: input.grant.sessionAddress as Address,
    calls: [{
      to: MONAD_ACTIVATION_CONFIG.luckyDraw as Address,
      value: 0n,
      data: encodeLuckyDrawCallData()
    }]
  })
}

export async function submitSessionUserOperation(input: {
  readonly live: LiveExecutionConfig
  readonly userOperation: Record<string, unknown>
}) {
  const bundler = createBundlerClient({
    transport: http(input.live.createBundlerUrl()),
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
    receipt: { success: receipt.success, txHash: receipt.receipt.transactionHash }
  }
}

/** Client helper type re-export for local signing with a session private key. */
export function sessionAccountFromPrivateKey(privateKey: `0x${string}`) {
  return privateKeyToAccount(privateKey)
}
