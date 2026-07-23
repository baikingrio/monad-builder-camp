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
import { entryPointDepositAbi } from '../../app/lib/entryPointDeposit'
import { evaluateSessionKeyDraw } from '../../app/lib/sessionKeyPolicy'
import { LUCKY_DRAW_DRAW_SELECTOR } from '../../app/lib/userOperationSimulation'
import type { LiveExecutionConfig } from './liveExecutionConfig'
import type { SessionGrantRecord } from './sqliteStore'
import { assertSufficientEntryPointDeposit } from './userFundedExecution'

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
    }
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

  const publicClient = createPublicClient({ chain: monadTestnet, transport: http(input.live.rpcUrl) })
  const account = await toSafeSmartAccount({
    client: publicClient,
    address: input.grant.safe as Address,
    owners: [signerPlaceholder(input.grant.sessionAddress as Address)],
    version: '1.4.1',
    entryPoint: { address: MONAD_ACTIVATION_CONFIG.entryPoint as Address, version: '0.7' },
    safe4337ModuleAddress: input.live.safe4337Module,
    safeModuleSetupAddress: MONAD_ACTIVATION_CONFIG.safeModuleSetup as Address,
    safeProxyFactoryAddress: MONAD_ACTIVATION_CONFIG.safeFactory as Address,
    safeSingletonAddress: MONAD_ACTIVATION_CONFIG.safeSingleton as Address,
    saltNonce: 0n,
    useMultiSendForSetup: false
  })
  // The private bundler URL is used only for gas estimation/submission. There is no Paymaster request.
  const bundler = createBundlerClient({ transport: http(input.live.createBundlerUrl()), chain: monadTestnet })
  const pimlico = createPimlicoClient({
    transport: http(input.live.createBundlerUrl()),
    entryPoint: { address: entryPoint07Address, version: '0.7' }
  })
  const gasPrice = await pimlico.getUserOperationGasPrice()
  const draft = {
    sender: account.address,
    nonce: await account.getNonce(),
    callData: await account.encodeCalls([{ to: MONAD_ACTIVATION_CONFIG.luckyDraw as Address, value: 0n, data: encodeLuckyDrawCallData() }]),
    maxFeePerGas: gasPrice.fast.maxFeePerGas,
    maxPriorityFeePerGas: gasPrice.fast.maxPriorityFeePerGas,
    signature: await account.getStubSignature()
  }
  const estimate = await bundler.estimateUserOperationGas({ entryPointAddress: entryPoint07Address, ...draft })
  const userOperation = serializeUserOperationForClient({
    sender: account.address,
    nonce: toHexQuantity(draft.nonce),
    callData: draft.callData,
    callGasLimit: toHexQuantity(estimate.callGasLimit),
    verificationGasLimit: toHexQuantity(estimate.verificationGasLimit),
    preVerificationGas: toHexQuantity(estimate.preVerificationGas),
    maxFeePerGas: toHexQuantity(draft.maxFeePerGas),
    maxPriorityFeePerGas: toHexQuantity(draft.maxPriorityFeePerGas),
    signature: '0x' as const
  })
  const gasBudget = BigInt(userOperation.callGasLimit) + BigInt(userOperation.verificationGasLimit) + BigInt(userOperation.preVerificationGas)
  if (gasBudget > input.live.maxGas) throw new Error(`user-funded user operation exceeds configured max gas (needed ${gasBudget.toString()}, max ${input.live.maxGas.toString()})`)
  const deposit = await publicClient.readContract({
    address: MONAD_ACTIVATION_CONFIG.entryPoint as Address,
    abi: entryPointDepositAbi,
    functionName: 'balanceOf',
    args: [account.address]
  })
  assertSufficientEntryPointDeposit({ deposit, userOperation })
  return { userOperation, entryPoint: MONAD_ACTIVATION_CONFIG.entryPoint }
}

export function assertSessionDrawSubmitBody(body: Record<string, unknown> | null | undefined): { preparationId: string; signature: string } {
  if (!body || typeof body.preparationId !== 'string' || body.preparationId.length < 1 || typeof body.signature !== 'string' || body.signature === '0x' || body.signature.length < 130) {
    throw new Error('session preparation ID and signature are required')
  }
  if (Object.keys(body).some(key => !['preparationId', 'signature', 'safe'].includes(key))) {
    throw new Error('caller-supplied user operation fields are forbidden')
  }
  return { preparationId: body.preparationId, signature: body.signature }
}

export function assertStoredSessionDrawOperation(input: { userOperation: Record<string, unknown>; safe: string; expectedCallData: string; deposit?: bigint }): void {
  const op = input.userOperation
  if (String(op.sender).toLowerCase() !== input.safe.toLowerCase()) throw new Error('stored operation sender does not match expected Safe')
  if (typeof op.factory !== 'undefined' || typeof op.factoryData !== 'undefined') throw new Error('stored user-funded operation must not contain factory fields')
  if (['paymaster', 'paymasterData', 'paymasterVerificationGasLimit', 'paymasterPostOpGasLimit'].some(field => typeof op[field] !== 'undefined')) throw new Error('stored user-funded operation must not contain paymaster fields')
  if (op.callData !== input.expectedCallData) throw new Error('stored operation callData is not the fixed LuckyDraw draw() call')
  if (input.deposit !== undefined) assertSufficientEntryPointDeposit({ deposit: input.deposit, userOperation: op as unknown as Parameters<typeof assertSufficientEntryPointDeposit>[0]['userOperation'] })
}

export function appendSessionSignature(input: { userOperation: Record<string, unknown>; signature: string }): Record<string, unknown> {
  return { ...input.userOperation, signature: input.signature }
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
