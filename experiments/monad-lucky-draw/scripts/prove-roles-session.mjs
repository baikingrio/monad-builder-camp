#!/usr/bin/env node
/**
 * On-chain proof: Roles enable + Session Key draw + unauthorized revert.
 *
 *   export PRIVATE_KEY=0x…
 *   export LUCKY_DRAW_PIMLICO_API_KEY=…
 *   npm run prove:roles-session
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  concatHex,
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  encodeFunctionData,
  getContractAddress,
  http,
  keccak256,
  parseEther,
  toBytes,
  toHex
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction'
import { toSafeSmartAccount } from 'permissionless/accounts'
import { createPimlicoClient } from 'permissionless/clients/pimlico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const receiptPath = resolve(root, 'contracts/artifacts/roles-session-proof.monad-testnet.json')

const CHAIN = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
})

const CFG = {
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  safeFactory: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
  safeSingleton: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
  safe4337Module: '0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226',
  safeModuleSetup: '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47',
  luckyDraw: '0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70',
  rolesMasterCopy: '0x9646fDAD06d3e24444381f44362a3B0eB343D337',
  rolesFactory: '0x000000000000aDdB49795b0f9bA5BC298cDda236'
}

const ROLE_KEY = keccak256(toBytes('LUCKY_DRAW'))
const DRAW_SELECTOR = '0x0eecae21'
/** Match app SESSION_KEY_GAS_TIP_WEI — covers ~3 draws at elevated Monad fees. */
const TIP = 100_000_000_000_000_000n
/** Monad EOA reserve: non-emptying txs must leave ≥ 10 MON. See docs.monad.xyz reserve-balance. */
const MONAD_EOA_RESERVE = parseEther('10')
const SENTINEL = '0x0000000000000000000000000000000000000001'

function loadEnvFile() {
  try {
    for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue
      const i = line.indexOf('=')
      const key = line.slice(0, i).trim()
      const val = line.slice(i + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* optional */ }
}

function pk() {
  const raw = (process.env.ROLES_DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || '').trim()
  if (!raw) throw new Error('Set PRIVATE_KEY')
  return raw.startsWith('0x') ? raw : `0x${raw}`
}

function setUpCall(safe) {
  const init = encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'address' }],
    [safe, safe, safe]
  )
  return encodeFunctionData({
    abi: [{ type: 'function', name: 'setUp', inputs: [{ type: 'bytes' }], outputs: [] }],
    functionName: 'setUp',
    args: [init]
  })
}

function predictRoles(safe) {
  const initializer = setUpCall(safe)
  const salt = keccak256(concatHex([keccak256(initializer), toHex(0n, { size: 32 })]))
  const center = CFG.rolesMasterCopy.toLowerCase().replace(/^0x/, '')
  const bytecode = `0x602d8060093d393df3363d3d373d3d3d363d73${center}5af43d82803e903d91602b57fd5bf3`
  return getContractAddress({ from: CFG.rolesFactory, opcode: 'CREATE2', salt, bytecode })
}

function buildEnableCalls(safe, session, owners, keep, opts = {}) {
  const roles = predictRoles(safe)
  const calls = []
  if (!opts.rolesDeployed) {
    calls.push({
      to: CFG.rolesFactory,
      value: 0n,
      data: encodeFunctionData({
        abi: [{
          type: 'function',
          name: 'deployModule',
          inputs: [{ type: 'address' }, { type: 'bytes' }, { type: 'uint256' }],
          outputs: [{ type: 'address' }]
        }],
        functionName: 'deployModule',
        args: [CFG.rolesMasterCopy, setUpCall(safe), 0n]
      })
    })
  }
  if (!opts.skipRemoveOwners) {
    let prev = SENTINEL
    for (const owner of owners) {
      if (owner.toLowerCase() === keep.toLowerCase()) {
        prev = owner
        continue
      }
      calls.push({
        to: safe,
        value: 0n,
        data: encodeFunctionData({
          abi: [{
            type: 'function',
            name: 'removeOwner',
            inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint256' }],
            outputs: []
          }],
          functionName: 'removeOwner',
          args: [prev, owner, 1n]
        })
      })
    }
  }
  if (!opts.moduleEnabled) {
    calls.push({
      to: safe,
      value: 0n,
      data: encodeFunctionData({
        abi: [{ type: 'function', name: 'enableModule', inputs: [{ type: 'address' }], outputs: [] }],
        functionName: 'enableModule',
        args: [roles]
      })
    })
  }
  if (!opts.permissionsConfigured) {
    calls.push({
      to: roles,
      value: 0n,
      data: encodeFunctionData({
        abi: [{ type: 'function', name: 'scopeTarget', inputs: [{ type: 'bytes32' }, { type: 'address' }], outputs: [] }],
        functionName: 'scopeTarget',
        args: [ROLE_KEY, CFG.luckyDraw]
      })
    })
    calls.push({
      to: roles,
      value: 0n,
      data: encodeFunctionData({
        abi: [{
          type: 'function',
          name: 'allowFunction',
          inputs: [{ type: 'bytes32' }, { type: 'address' }, { type: 'bytes4' }, { type: 'uint8' }],
          outputs: []
        }],
        functionName: 'allowFunction',
        args: [ROLE_KEY, CFG.luckyDraw, DRAW_SELECTOR, 0]
      })
    })
  }
  calls.push({
    to: roles,
    value: 0n,
    data: encodeFunctionData({
      abi: [{
        type: 'function',
        name: 'assignRoles',
        inputs: [{ type: 'address' }, { type: 'bytes32[]' }, { type: 'bool[]' }],
        outputs: []
      }],
      functionName: 'assignRoles',
      args: [session, [ROLE_KEY], [true]]
    })
  })
  calls.push({ to: session, value: TIP, data: '0x' })
  return { calls, roles }
}

async function main() {
  loadEnvFile()
  const ownerAccount = privateKeyToAccount(pk())
  const sessionAccount = privateKeyToAccount(generatePrivateKey())
  const apiKey = process.env.LUCKY_DRAW_PIMLICO_API_KEY
  if (!apiKey) throw new Error('Set LUCKY_DRAW_PIMLICO_API_KEY')

  const rpc = process.env.NUXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'
  const bundlerUrl = `https://api.pimlico.io/v2/monad-testnet/rpc?add_balance_override&apikey=${encodeURIComponent(apiKey)}`
  const publicClient = createPublicClient({ chain: CHAIN, transport: http(rpc) })
  const wallet = createWalletClient({ account: ownerAccount, chain: CHAIN, transport: http(rpc) })

  // Derive Safe the same way as the app (permissionless counterfactual salt 0).
  const tempAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [ownerAccount],
    version: '1.4.1',
    entryPoint: { address: CFG.entryPoint, version: '0.7' },
    safe4337ModuleAddress: CFG.safe4337Module,
    safeModuleSetupAddress: CFG.safeModuleSetup,
    safeProxyFactoryAddress: CFG.safeFactory,
    safeSingletonAddress: CFG.safeSingleton,
    saltNonce: 0n,
    useMultiSendForSetup: false
  })
  const safe = process.env.SAFE || tempAccount.address
  console.log({ owner: ownerAccount.address, safe, session: sessionAccount.address })

  const need = TIP + parseEther('0.01')
  const safeBal = await publicClient.getBalance({ address: safe })
  if (safeBal < need) {
    const ownerBal = await publicClient.getBalance({ address: ownerAccount.address })
    const ownerCode = await publicClient.getCode({ address: ownerAccount.address })
    const delegated = Boolean(ownerCode && ownerCode !== '0x' && ownerCode.startsWith('0xef0100'))
    // Gas buffer for a simple transfer under Monad fee market.
    const gasBuffer = parseEther('0.05')
    const minOwnerAfter = delegated ? MONAD_EOA_RESERVE : 0n
    const minOwnerBefore = need + gasBuffer + minOwnerAfter
    if (ownerBal < minOwnerBefore) {
      throw new Error(
        [
          'Cannot fund Safe tip: Monad reserve-balance would be violated.',
          `owner=${ownerAccount.address}`,
          `ownerBalance=${ownerBal} wei (~${Number(ownerBal) / 1e18} MON)`,
          `eip7702Delegated=${delegated}`,
          `needTransfer=${need} wei + ~0.05 MON gas buffer`,
          delegated
            ? `Delegated EOAs must keep ≥ ${MONAD_EOA_RESERVE} wei (10 MON) after the transfer.`
            : 'Undelegated EOAs below 10 MON must use an emptying tx (first tx in k blocks).',
          'Fix: faucet https://faucet.monad.xyz until owner has ≥ ~10.1 MON (recommended ≥ 11 MON), then re-run.',
          'Alt: undelegate EIP-7702 on the owner, then re-run (emptying exception may apply).'
        ].join('\n')
      )
    }
    // Safe receive() uses DELEGATECALL — do not pin gas to 21_000.
    const h = await wallet.sendTransaction({ to: safe, value: need })
    const tipReceipt = await publicClient.waitForTransactionReceipt({ hash: h })
    if (tipReceipt.status !== 'success') throw new Error(`Safe tip funding reverted: ${h}`)
    console.log('funded Safe', h)
  }

  const owners = await publicClient.readContract({
    address: safe,
    abi: [{ type: 'function', name: 'getOwners', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] }],
    functionName: 'getOwners'
  })
  const predictedRoles = predictRoles(safe)
  const rolesCode = await publicClient.getCode({ address: predictedRoles })
  const rolesDeployed = Boolean(rolesCode && rolesCode !== '0x')
  let moduleEnabled = false
  if (rolesDeployed) {
    moduleEnabled = await publicClient.readContract({
      address: safe,
      abi: [{ type: 'function', name: 'isModuleEnabled', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] }],
      functionName: 'isModuleEnabled',
      args: [predictedRoles]
    })
  }
  const { calls, roles } = buildEnableCalls(safe, sessionAccount.address, owners, ownerAccount.address, {
    rolesDeployed,
    moduleEnabled,
    // Permissions already configured on first successful enable; re-scoping can revert.
    permissionsConfigured: moduleEnabled,
    skipRemoveOwners: owners.length === 1 && owners[0].toLowerCase() === ownerAccount.address.toLowerCase()
  })
  console.log('rolesModifier', roles, { rolesDeployed, moduleEnabled, callCount: calls.length })

  const account = await toSafeSmartAccount({
    client: publicClient,
    address: safe,
    owners: [ownerAccount],
    version: '1.4.1',
    entryPoint: { address: CFG.entryPoint, version: '0.7' },
    safe4337ModuleAddress: CFG.safe4337Module,
    safeModuleSetupAddress: CFG.safeModuleSetup,
    safeProxyFactoryAddress: CFG.safeFactory,
    safeSingletonAddress: CFG.safeSingleton,
    saltNonce: 0n,
    useMultiSendForSetup: false
  })
  const bundler = createBundlerClient({ transport: http(bundlerUrl), chain: CHAIN })
  const pimlico = createPimlicoClient({
    transport: http(bundlerUrl),
    entryPoint: { address: entryPoint07Address, version: '0.7' }
  })
  const fee = (await pimlico.getUserOperationGasPrice()).standard
  const draft = {
    sender: account.address,
    nonce: await account.getNonce(),
    callData: await account.encodeCalls(calls),
    maxFeePerGas: fee.maxFeePerGas,
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
    signature: await account.getStubSignature()
  }
  const estimate = await bundler.estimateUserOperationGas({ entryPointAddress: entryPoint07Address, ...draft })
  const gasUnits = estimate.callGasLimit + estimate.verificationGasLimit + estimate.preVerificationGas
  const requiredPrefund = (gasUnits * fee.maxFeePerGas * 120n) / 100n
  const deposit = await publicClient.readContract({
    address: CFG.entryPoint,
    abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
    functionName: 'balanceOf',
    args: [safe]
  })
  if (deposit < requiredPrefund) {
    const topUp = requiredPrefund - deposit + parseEther('0.05')
    const ownerBal = await publicClient.getBalance({ address: ownerAccount.address })
    const ownerCode = await publicClient.getCode({ address: ownerAccount.address })
    const delegated = Boolean(ownerCode && ownerCode !== '0x' && ownerCode.startsWith('0xef0100'))
    const gasBuffer = parseEther('0.05')
    const minAfter = delegated ? MONAD_EOA_RESERVE : 0n
    if (ownerBal < topUp + gasBuffer + minAfter) {
      throw new Error(
        `Need EntryPoint deposit top-up ${topUp} wei but owner cannot fund under Monad reserve. faucet https://faucet.monad.xyz then re-run.`
      )
    }
    const depositData = encodeFunctionData({
      abi: [{ type: 'function', name: 'depositTo', stateMutability: 'payable', inputs: [{ type: 'address' }], outputs: [] }],
      functionName: 'depositTo',
      args: [safe]
    })
    const dh = await wallet.sendTransaction({ to: CFG.entryPoint, data: depositData, value: topUp })
    const depReceipt = await publicClient.waitForTransactionReceipt({ hash: dh })
    if (depReceipt.status !== 'success') throw new Error(`EntryPoint depositTo reverted: ${dh}`)
    console.log('topped up EntryPoint deposit', { topUp: topUp.toString(), tx: dh })
  }

  const userOperation = {
    ...draft,
    callGasLimit: estimate.callGasLimit,
    verificationGasLimit: estimate.verificationGasLimit,
    preVerificationGas: estimate.preVerificationGas,
    signature: await account.signUserOperation({
      ...draft,
      callGasLimit: estimate.callGasLimit,
      verificationGasLimit: estimate.verificationGasLimit,
      preVerificationGas: estimate.preVerificationGas
    })
  }
  console.log('submitting enable UserOp…')
  const userOpHash = await bundler.sendUserOperation({ entryPointAddress: entryPoint07Address, ...userOperation })
  const enableReceipt = await bundler.waitForUserOperationReceipt({ hash: userOpHash, timeout: 180_000 })
  if (!enableReceipt.success) throw new Error(`enable failed ${enableReceipt.receipt.transactionHash}`)
  console.log('enable tx', enableReceipt.receipt.transactionHash)

  // Session Key pays native gas; top up if tip alone is short under elevated fees.
  const minSessionGas = parseEther('0.05')
  const sessionBal = await publicClient.getBalance({ address: sessionAccount.address })
  if (sessionBal < minSessionGas) {
    const top = minSessionGas - sessionBal + parseEther('0.02')
    const ownerBal = await publicClient.getBalance({ address: ownerAccount.address })
    const ownerCode = await publicClient.getCode({ address: ownerAccount.address })
    const delegated = Boolean(ownerCode && ownerCode !== '0x' && ownerCode.startsWith('0xef0100'))
    if (ownerBal < top + parseEther('0.05') + (delegated ? MONAD_EOA_RESERVE : 0n)) {
      throw new Error(`Session Key needs ${top} wei gas; owner cannot top up under Monad reserve.`)
    }
    const sh = await wallet.sendTransaction({ to: sessionAccount.address, value: top })
    const sReceipt = await publicClient.waitForTransactionReceipt({ hash: sh })
    if (sReceipt.status !== 'success') throw new Error(`session gas top-up reverted: ${sh}`)
    console.log('topped up session gas', sh)
  }

  const sessionWallet = createWalletClient({ account: sessionAccount, chain: CHAIN, transport: http(rpc) })
  const drawData = encodeFunctionData({
    abi: [{
      type: 'function',
      name: 'execTransactionWithRole',
      inputs: [
        { type: 'address' }, { type: 'uint256' }, { type: 'bytes' },
        { type: 'uint8' }, { type: 'bytes32' }, { type: 'bool' }
      ],
      outputs: [{ type: 'bool' }]
    }],
    functionName: 'execTransactionWithRole',
    args: [CFG.luckyDraw, 0n, DRAW_SELECTOR, 0, ROLE_KEY, true]
  })
  // Explicit gas: Monad charges declared gas_limit; keep buffer but avoid huge defaults.
  const drawGas = await publicClient.estimateGas({
    account: sessionAccount.address,
    to: roles,
    data: drawData,
    value: 0n
  })
  console.log('session draw…')
  const drawHash = await sessionWallet.sendTransaction({
    to: roles,
    data: drawData,
    value: 0n,
    gas: (drawGas * 120n) / 100n
  })
  const drawReceipt = await publicClient.waitForTransactionReceipt({ hash: drawHash })
  if (drawReceipt.status !== 'success') throw new Error(`draw failed ${drawHash}`)
  console.log('draw tx', drawHash)

  let unauthorizedReverted = false
  let unauthorizedError = ''
  try {
    await publicClient.simulateContract({
      account: sessionAccount.address,
      address: roles,
      abi: [{
        type: 'function',
        name: 'execTransactionWithRole',
        inputs: [
          { type: 'address' }, { type: 'uint256' }, { type: 'bytes' },
          { type: 'uint8' }, { type: 'bytes32' }, { type: 'bool' }
        ],
        outputs: [{ type: 'bool' }]
      }],
      functionName: 'execTransactionWithRole',
      args: [CFG.luckyDraw, 0n, '0x9e2822cf', 0, ROLE_KEY, true]
    })
  } catch (error) {
    unauthorizedReverted = true
    unauthorizedError = error instanceof Error ? error.message : String(error)
  }
  if (!unauthorizedReverted) throw new Error('expected unauthorized selector to revert')
  console.log('unauthorized reverted OK')

  const proof = {
    chainId: 10143,
    provedAt: new Date().toISOString(),
    owner: ownerAccount.address,
    safe,
    sessionAddress: sessionAccount.address,
    rolesModifier: roles,
    enableTx: enableReceipt.receipt.transactionHash,
    enableUserOpHash: userOpHash,
    drawTx: drawHash,
    unauthorizedReverted,
    unauthorizedError: unauthorizedError.slice(0, 240)
  }
  mkdirSync(dirname(receiptPath), { recursive: true })
  writeFileSync(receiptPath, JSON.stringify(proof, null, 2))
  console.log('wrote', receiptPath)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
