import { isAddress, parseUnits, type Address } from 'viem'

export type Erc1363DeploymentInput = {
  tokenAddress?: string
  vaultAddress?: string
}

export type Erc1363Deployment = {
  tokenAddress: Address
  vaultAddress: Address
}

const zeroAddress = '0x0000000000000000000000000000000000000000'

function deployedAddress(address: string | undefined): address is Address {
  return Boolean(address && isAddress(address) && address.toLowerCase() !== zeroAddress)
}

export function validateErc1363Deployment(input: Erc1363DeploymentInput): boolean {
  return deployedAddress(input.tokenAddress) && deployedAddress(input.vaultAddress)
}

export function getErc1363Deployment(input: Erc1363DeploymentInput): Erc1363Deployment | null {
  if (!validateErc1363Deployment(input)) return null
  return { tokenAddress: input.tokenAddress, vaultAddress: input.vaultAddress }
}

/** Converts a user-entered decimal amount to positive token base units. */
export function parseTokenAmount(value: string, decimals = 18): bigint {
  const input = value.trim()
  if (!/^\d+(?:\.\d+)?$/.test(input)) throw new Error('请输入有效的代币数量。')

  const fraction = input.split('.')[1]
  if (fraction && fraction.length > decimals) throw new Error(`小数位最多支持 ${decimals} 位。`)

  const amount = parseUnits(input, decimals)
  if (amount <= 0n) throw new Error('数量必须大于 0。')
  return amount
}

export const erc1363TokenAbi = [
  {
    type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function', name: 'decimals', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'uint8' }]
  },
  {
    type: 'function', name: 'symbol', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'string' }]
  },
  {
    type: 'function', name: 'transferAndCall', stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' }
    ], outputs: [{ name: '', type: 'bool' }]
  }
] as const

export const erc1363VaultAbi = [
  {
    type: 'function', name: 'stakedBalance', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function', name: 'pendingRewards', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }]
  },
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'function', name: 'withdraw', stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }], outputs: []
  }
] as const
