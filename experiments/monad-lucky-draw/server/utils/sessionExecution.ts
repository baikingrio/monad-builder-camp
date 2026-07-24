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
  type UnsignedUserOperation
} from '../../app/lib/activationUserOperation'
import { MONAD_ACTIVATION_CONFIG } from '../../app/lib/monadConfig'
import { entryPointDepositAbi } from '../../app/lib/entryPointDeposit'
import { evaluateSessionKeyDraw } from '../../app/lib/sessionKeyPolicy'
import { LUCKY_DRAW_DRAW_SELECTOR } from '../../app/lib/userOperationSimulation'
import type { LiveExecutionConfig } from './liveExecutionConfig'
import type { SessionGrantRecord } from './sqliteStore'
import { assertSufficientEntryPointDeposit } from './userFundedExecution'
import { assertRolesSessionEnableAllowed, buildRolesSessionEnableCalls, predictRolesProxyAddress } from './rolesSessionEnable'

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
})

const SAFE_IS_MODULE_ENABLED_ABI = [{
  type: 'function',
  name: 'isModuleEnabled',
  stateMutability: 'view',
  inputs: [{ name: 'module', type: 'address' }],
  outputs: [{ type: 'bool' }]
}] as const

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

/**
 * Builds an unsigned UserOperation paid by EntryPoint.balanceOf(safe).
 * Uses the private Bundler URL for gas price + estimate only — no Paymaster.
 */
async function prepareUserFundedSafeCalls(input: {
  readonly live: LiveExecutionConfig
  readonly safe: Address
  readonly signerAddress: Address
  readonly calls: readonly { to: Address; value: bigint; data: Hex }[]
}): Promise<{ readonly userOperation: UnsignedUserOperation; readonly entryPoint: string }> {
  const publicClient = createPublicClient({ chain: monadTestnet, transport: http(input.live.rpcUrl) })
  const bundlerUrl = input.live.createBundlerUrl()
  const bundler = createBundlerClient({ transport: http(bundlerUrl), chain: monadTestnet })
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

  const gasPrice = await pimlico.getUserOperationGasPrice()
  // Prefer standard over fast: user-funded prefund is paid from deposit; fast pricing often overshoots testnet needs.
  const fee = gasPrice.standard ?? gasPrice.fast
  const draft = {
    sender: account.address,
    nonce: await account.getNonce(),
    callData: await account.encodeCalls([...input.calls]),
    maxFeePerGas: fee.maxFeePerGas,
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
    signature: await account.getStubSignature()
  }
  const estimate = await bundler.estimateUserOperationGas({
    entryPointAddress: entryPoint07Address,
    ...draft
  })
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

  const gasBudget = BigInt(userOperation.callGasLimit)
    + BigInt(userOperation.verificationGasLimit)
    + BigInt(userOperation.preVerificationGas)
  if (gasBudget > input.live.maxGas) {
    throw new Error(`user-funded user operation exceeds configured max gas (needed ${gasBudget.toString()}, max ${input.live.maxGas.toString()})`)
  }

  const deposit = await publicClient.readContract({
    address: MONAD_ACTIVATION_CONFIG.entryPoint as Address,
    abi: entryPointDepositAbi,
    functionName: 'balanceOf',
    args: [account.address]
  })
  assertSufficientEntryPointDeposit({ deposit, userOperation })

  return { userOperation, entryPoint: MONAD_ACTIVATION_CONFIG.entryPoint }
}

/** Owner-signed UserOp that adds the session key as a Safe owner (threshold stays 1). Paid by EntryPoint deposit. */
export async function prepareSessionEnableUserOperation(input: {
  readonly live: LiveExecutionConfig
  readonly owner: Address
  readonly safe: Address
  readonly sessionAddress: Address
  /** Optional override; otherwise predicted via ModuleProxyFactory CREATE2. */
  readonly rolesModifier?: Address
  /** Extra Safe owners to remove during Roles enable (keep primary EOA). */
  readonly removeOwners?: readonly { readonly prevOwner: Address; readonly owner: Address }[]
}) {
  if (MONAD_ACTIVATION_CONFIG.rolesSessionEnabled === true) {
    assertRolesSessionEnableAllowed()
    const publicClient = createPublicClient({ chain: monadTestnet, transport: http(input.live.rpcUrl) })
    const rolesModifier = input.rolesModifier ?? predictRolesProxyAddress({ safe: input.safe })
    const bytecode = await publicClient.getBytecode({ address: rolesModifier })
    const rolesDeployed = Boolean(bytecode && bytecode !== '0x' && bytecode.length > 2)
    let moduleEnabled = false
    if (rolesDeployed) {
      moduleEnabled = await publicClient.readContract({
        address: input.safe,
        abi: SAFE_IS_MODULE_ENABLED_ABI,
        functionName: 'isModuleEnabled',
        args: [rolesModifier]
      })
    }
    const { calls, rolesModifier: resolvedModifier } = buildRolesSessionEnableCalls({
      safe: input.safe,
      sessionAddress: input.sessionAddress,
      rolesModifier,
      removeOwners: input.removeOwners,
      skipDeploy: rolesDeployed,
      skipEnableModule: moduleEnabled,
      // First successful enable configured draw-only permissions; re-scoping can revert.
      skipPermissions: moduleEnabled,
      deploy: rolesDeployed
        ? undefined
        : {
            factory: MONAD_ACTIVATION_CONFIG.rolesModuleProxyFactory as Address,
            masterCopy: MONAD_ACTIVATION_CONFIG.rolesMasterCopy as Address,
            saltNonce: 0n
          }
    })
    if (calls.length < 1) throw new Error('roles-enable-calls-empty')
    const prepared = await prepareUserFundedSafeCalls({
      live: input.live,
      safe: input.safe,
      signerAddress: input.owner,
      calls
    })
    return { ...prepared, rolesModifier: resolvedModifier, mode: 'roles' as const }
  }

  const data = encodeFunctionData({
    abi: ADD_OWNER_ABI,
    functionName: 'addOwnerWithThreshold',
    args: [input.sessionAddress, 1n]
  })
  return {
    ...(await prepareUserFundedSafeCalls({
      live: input.live,
      safe: input.safe,
      signerAddress: input.owner,
      calls: [{ to: input.safe, value: 0n, data }]
    })),
    mode: 'legacy' as const
  }
}

/** Session-key-signed UserOp that only calls LuckyDraw.draw(). Paid by EntryPoint deposit. Legacy path only. */
export async function prepareSessionDrawUserOperation(input: {
  readonly live: LiveExecutionConfig
  readonly grant: SessionGrantRecord
  readonly now: number
}) {
  if (input.grant.mode === 'roles') {
    throw new Error('roles-grant-must-use-eoa-draw-path')
  }
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

  return prepareUserFundedSafeCalls({
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
    // Paymaster fields only when present (sponsored activation-era ops). Session enable/draw are user-funded.
    ...(typeof raw.paymaster === 'string' ? {
      paymaster: raw.paymaster as Address,
      paymasterVerificationGasLimit: BigInt(String(raw.paymasterVerificationGasLimit ?? '0x0')),
      paymasterPostOpGasLimit: BigInt(String(raw.paymasterPostOpGasLimit ?? '0x0')),
      paymasterData: (raw.paymasterData as Hex) ?? '0x'
    } : {}),
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
