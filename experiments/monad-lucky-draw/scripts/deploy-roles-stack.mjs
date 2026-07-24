#!/usr/bin/env node
/**
 * Broadcast Zodiac Roles stack to Monad Testnet via ERC-2470 CREATE2 factory.
 *
 * Requires:
 *   ROLES_ALLOW_BROADCAST=true
 *   PRIVATE_KEY or ROLES_DEPLOYER_PRIVATE_KEY (0x…)
 *
 * Deploys (idempotent if already present): Integrity → Packer → Roles → ModuleProxyFactory
 * to their canonical CREATE2 addresses from contracts/artifacts/roles-mastercopies.slim.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  encodeFunctionData,
  concatHex,
  http
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const artifactsPath = resolve(root, 'contracts/artifacts/roles-mastercopies.slim.json')
const receiptPath = resolve(root, 'contracts/artifacts/roles-deploy-receipt.monad-testnet.json')

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
})

const FACTORY_ABI = [{
  type: 'function',
  name: 'deploy',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'bytecode', type: 'bytes' },
    { name: 'salt', type: 'bytes32' }
  ],
  outputs: [{ name: 'createdContract', type: 'address' }]
}]

function requireBroadcastGate() {
  if (process.env.ROLES_ALLOW_BROADCAST !== 'true') {
    throw new Error('Set ROLES_ALLOW_BROADCAST=true after checklist authorization')
  }
}

function loadPrivateKey() {
  const raw = (process.env.ROLES_DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || '').trim()
  if (!raw || raw === '0x') {
    throw new Error('Set PRIVATE_KEY or ROLES_DEPLOYER_PRIVATE_KEY for broadcast')
  }
  return raw.startsWith('0x') ? raw : `0x${raw}`
}

function creationBytecode(artifact) {
  const { bytecode, constructorArgs } = artifact
  if (!constructorArgs?.types?.length) return bytecode
  return concatHex([
    bytecode,
    encodeAbiParameters(
      constructorArgs.types.map((type) => ({ type })),
      constructorArgs.values
    )
  ])
}

function hasCode(bytecode) {
  return typeof bytecode === 'string' && bytecode !== '0x' && bytecode.length > 2
}

async function main() {
  requireBroadcastGate()
  const account = privateKeyToAccount(loadPrivateKey())
  const artifacts = JSON.parse(readFileSync(artifactsPath, 'utf8'))
  const factory = artifacts.erc2470Factory
  const order = ['Integrity', 'Packer', 'Roles', 'ModuleProxyFactory']

  const publicClient = createPublicClient({ chain: monadTestnet, transport: http() })
  const walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http()
  })

  console.log('deployer', account.address)
  console.log('chain', monadTestnet.id)
  console.log('factory', factory)

  const results = []
  for (const name of order) {
    const artifact = artifacts.artifacts[name]
    if (!artifact) throw new Error(`missing artifact ${name}`)
    const existing = await publicClient.getBytecode({ address: artifact.address })
    if (hasCode(existing)) {
      console.log(`skip ${name} already at ${artifact.address}`)
      results.push({ name, address: artifact.address, noop: true })
      continue
    }

    const initCode = creationBytecode(artifact)
    const data = encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: 'deploy',
      args: [initCode, artifact.salt]
    })

    console.log(`deploying ${name} → ${artifact.address}…`)
    const hash = await walletClient.sendTransaction({
      to: factory,
      data,
      // CREATE2 via factory: give headroom beyond estimate (RPC underestimates CREATE2)
      gas: 8_000_000n
    })
    console.log(`  tx ${hash}`)
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 })
    if (receipt.status !== 'success') throw new Error(`${name} deploy failed: ${hash}`)
    const code = await publicClient.getBytecode({ address: artifact.address })
    if (!hasCode(code)) throw new Error(`${name} missing code at predicted address ${artifact.address}`)
    console.log(`  ok ${name} codeLen=${code.length}`)
    results.push({ name, address: artifact.address, noop: false, txHash: hash })
  }

  const summary = {
    chainId: 10143,
    deployer: account.address,
    factory,
    deployedAt: new Date().toISOString(),
    results,
    addresses: {
      rolesMasterCopy: artifacts.artifacts.Roles.address,
      moduleProxyFactory: artifacts.artifacts.ModuleProxyFactory.address,
      integrity: artifacts.artifacts.Integrity.address,
      packer: artifacts.artifacts.Packer.address,
      erc2470Factory: factory
    }
  }
  mkdirSync(dirname(receiptPath), { recursive: true })
  writeFileSync(receiptPath, JSON.stringify(summary, null, 2))
  console.log('wrote', receiptPath)
  console.log(JSON.stringify(summary.addresses, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
