import { encodeFunctionData } from 'viem'
import { monadTestnet } from './erc4337Experiments'
import { EIP7702_TARGET } from './erc7702'
import {
  MONAD_ENTRY_POINT_V06,
  MONAD_SAFE_4337_MODULE_V020,
  MONAD_TESTNET_CHAIN_ID
} from './safe4337MonadConfig'

export type SafePasskeyNetworkId = 'sepolia' | 'monad'

/** Canonical AddModulesLib on Monad Testnet（链上已部署，与 Sepolia 同地址）。 */
export const MONAD_ADD_MODULES_LIB = '0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb' as const
/** SafeWebAuthnSharedSigner on Monad Testnet（链上已部署，SDK 包未收录 10143）。 */
export const MONAD_SAFE_WEBAUTHN_SHARED_SIGNER = '0x94a4F6affBd8975951142c3999aEAB7ecee555c2' as const

export type SafePasskeyCustomContracts = {
  entryPointAddress: string
  safe4337ModuleAddress: string
  addModulesLibAddress: string
  safeWebAuthnSharedSignerAddress: string
}

export type SafePasskeyNetworkProfile = {
  id: SafePasskeyNetworkId
  label: string
  chainId: number
  rpcUrl: string
  customContracts?: SafePasskeyCustomContracts
  sepoliaPaymasterAddress?: string
  practiceTargetLabel: string
  practiceTargetAddress: string
  envKeyHint: string
  experimentalNote?: string
  buildPracticeCalldata: (safeAddress: string) => `0x${string}`
}

export const SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com'
export const SEPOLIA_CHAIN_ID = 11155111
export const SEPOLIA_PAYMASTER_ADDRESS = '0x0000000000325602a77416A16136FDafd04b299f'
export const SAFE_PASSKEY_NFT_ADDRESS = '0xBb9ebb7b8Ee75CDBf64e5cE124731A89c2BC4A07'

const nftMintAbi = [{
  type: 'function',
  name: 'safeMint',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }],
  outputs: []
}] as const

const checkInAbi = [{
  type: 'function',
  name: 'checkIn',
  stateMutability: 'nonpayable',
  inputs: [],
  outputs: []
}] as const

function randomUint256(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bytes.reduce((result, value) => (result << 8n) | BigInt(value), 0n)
}

export const SAFE_PASSKEY_NETWORKS: Record<SafePasskeyNetworkId, SafePasskeyNetworkProfile> = {
  sepolia: {
    id: 'sepolia',
    label: 'Ethereum Sepolia',
    chainId: SEPOLIA_CHAIN_ID,
    rpcUrl: SEPOLIA_RPC_URL,
    sepoliaPaymasterAddress: SEPOLIA_PAYMASTER_ADDRESS,
    practiceTargetLabel: '教程 NFT（safeMint）',
    practiceTargetAddress: SAFE_PASSKEY_NFT_ADDRESS,
    envKeyHint: 'NUXT_PUBLIC_PIMLICO_API_KEY',
    buildPracticeCalldata: (safeAddress) => encodeFunctionData({
      abi: nftMintAbi,
      functionName: 'safeMint',
      args: [safeAddress as `0x${string}`, randomUint256()]
    })
  },
  monad: {
    id: 'monad',
    label: 'Monad Testnet',
    chainId: MONAD_TESTNET_CHAIN_ID,
    rpcUrl: monadTestnet.rpcUrls.default.http[0]!,
    customContracts: {
      entryPointAddress: MONAD_ENTRY_POINT_V06,
      safe4337ModuleAddress: MONAD_SAFE_4337_MODULE_V020,
      addModulesLibAddress: MONAD_ADD_MODULES_LIB,
      safeWebAuthnSharedSignerAddress: MONAD_SAFE_WEBAUTHN_SHARED_SIGNER
    },
    practiceTargetLabel: 'Check-in 练习合约（checkIn）',
    practiceTargetAddress: EIP7702_TARGET,
    envKeyHint: 'NUXT_PUBLIC_MONAD_PIMLICO_API_KEY（或复用 NUXT_PUBLIC_PIMLICO_API_KEY）',
    experimentalNote:
      'Relay Kit v3 仅支持 Safe Modules 0.2.0，故 Passkeys 实验使用 EntryPoint v0.6 + Module v0.2.0（非 /safe-4337-monad 页的 v0.7 只读验证栈）。Shared Signer / FCL Verifier 已部署；SignerFactory canonical 地址无 bytecode，需 Protocol Kit 补丁。Pimlico 需启用 Monad Testnet。',
    buildPracticeCalldata: () => encodeFunctionData({
      abi: checkInAbi,
      functionName: 'checkIn',
      args: []
    })
  }
}

export function parseSafePasskeyNetworkId(value: unknown): SafePasskeyNetworkId {
  return value === 'monad' ? 'monad' : 'sepolia'
}

export function getSafePasskeyNetworkProfile(id: SafePasskeyNetworkId): SafePasskeyNetworkProfile {
  return SAFE_PASSKEY_NETWORKS[id]
}
