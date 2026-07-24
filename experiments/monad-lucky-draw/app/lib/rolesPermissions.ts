import { concatHex, encodeAbiParameters, encodeFunctionData, getContractAddress, keccak256, toBytes, toHex, type Address, type Hex } from 'viem'
import { MONAD_ACTIVATION_CONFIG } from './monadConfig'
import { LUCKY_DRAW_DRAW_SELECTOR } from './userOperationSimulation'

/** Fixed role key for LuckyDraw-only session members. */
export const LUCKY_DRAW_ROLE_KEY = keccak256(toBytes('LUCKY_DRAW'))

/** Native tip to Session Key on Roles enable. Sized for ~3 Monad draws at elevated gas prices. */
export const SESSION_KEY_GAS_TIP_WEI = 100_000_000_000_000_000n // 0.1 MON

/** Default saltNonce for per-Safe Roles proxy deploy via ModuleProxyFactory. */
export const ROLES_PROXY_SALT_NONCE = 0n

/** Roles ExecutionOptions.None — Call only, no native Send / DelegateCall. */
export const EXECUTION_OPTIONS_NONE = 0

export const ROLES_SETUP_ABI = [{
  type: 'function',
  name: 'setUp',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'initParams', type: 'bytes' }],
  outputs: []
}] as const

export const MODULE_PROXY_FACTORY_ABI = [{
  type: 'function',
  name: 'deployModule',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'masterCopy', type: 'address' },
    { name: 'initializer', type: 'bytes' },
    { name: 'saltNonce', type: 'uint256' }
  ],
  outputs: [{ name: 'proxy', type: 'address' }]
}] as const

export const SAFE_ENABLE_MODULE_ABI = [{
  type: 'function',
  name: 'enableModule',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'module', type: 'address' }],
  outputs: []
}] as const

export const SAFE_REMOVE_OWNER_ABI = [{
  type: 'function',
  name: 'removeOwner',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'prevOwner', type: 'address' },
    { name: 'owner', type: 'address' },
    { name: '_threshold', type: 'uint256' }
  ],
  outputs: []
}] as const

export const ROLES_CONFIG_ABI = [
  {
    type: 'function',
    name: 'scopeTarget',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roleKey', type: 'bytes32' },
      { name: 'targetAddress', type: 'address' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'allowFunction',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roleKey', type: 'bytes32' },
      { name: 'targetAddress', type: 'address' },
      { name: 'selector', type: 'bytes4' },
      { name: 'options', type: 'uint8' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'assignRoles',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'module', type: 'address' },
      { name: 'roleKeys', type: 'bytes32[]' },
      { name: 'memberOf', type: 'bool[]' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'execTransactionWithRole',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'roleKey', type: 'bytes32' },
      { name: 'shouldRevert', type: 'bool' }
    ],
    outputs: [{ name: 'success', type: 'bool' }]
  }
] as const

export function encodeRolesSetUpInitParams(input: {
  readonly owner: Address
  readonly avatar: Address
  readonly target: Address
}): Hex {
  return encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'address' }],
    [input.owner, input.avatar, input.target]
  )
}

export function encodeRolesSetUpCall(input: {
  readonly owner: Address
  readonly avatar: Address
  readonly target: Address
}): Hex {
  return encodeFunctionData({
    abi: ROLES_SETUP_ABI,
    functionName: 'setUp',
    args: [encodeRolesSetUpInitParams(input)]
  })
}

export function encodeDeployRolesModule(input: {
  readonly masterCopy: Address
  readonly owner: Address
  readonly saltNonce: bigint
}): Hex {
  return encodeFunctionData({
    abi: MODULE_PROXY_FACTORY_ABI,
    functionName: 'deployModule',
    args: [
      input.masterCopy,
      encodeRolesSetUpCall({ owner: input.owner, avatar: input.owner, target: input.owner }),
      input.saltNonce
    ]
  })
}

/** EIP-1167 minimal proxy creation code used by Zodiac ModuleProxyFactory. */
export function rolesProxyCreationBytecode(masterCopy: Address): Hex {
  const center = masterCopy.toLowerCase().replace(/^0x/, '')
  return `0x602d8060093d393df3363d3d373d3d3d363d73${center}5af43d82803e903d91602b57fd5bf3` as Hex
}

/** Predict Roles modifier proxy address for a Safe (ModuleProxyFactory CREATE2). */
export function predictRolesProxyAddress(input: {
  readonly safe: Address
  readonly factory?: Address
  readonly masterCopy?: Address
  readonly saltNonce?: bigint
}): Address {
  const factory = (input.factory ?? MONAD_ACTIVATION_CONFIG.rolesModuleProxyFactory) as Address
  const masterCopy = (input.masterCopy ?? MONAD_ACTIVATION_CONFIG.rolesMasterCopy) as Address
  const saltNonce = input.saltNonce ?? ROLES_PROXY_SALT_NONCE
  const initializer = encodeRolesSetUpCall({ owner: input.safe, avatar: input.safe, target: input.safe })
  const salt = keccak256(concatHex([
    keccak256(initializer),
    toHex(saltNonce, { size: 32 })
  ]))
  return getContractAddress({
    from: factory,
    opcode: 'CREATE2',
    salt,
    bytecode: rolesProxyCreationBytecode(masterCopy)
  })
}

export function encodeEnableModule(module: Address): Hex {
  return encodeFunctionData({
    abi: SAFE_ENABLE_MODULE_ABI,
    functionName: 'enableModule',
    args: [module]
  })
}

export function encodeRemoveOwner(input: {
  readonly prevOwner: Address
  readonly owner: Address
  readonly threshold?: bigint
}): Hex {
  return encodeFunctionData({
    abi: SAFE_REMOVE_OWNER_ABI,
    functionName: 'removeOwner',
    args: [input.prevOwner, input.owner, input.threshold ?? 1n]
  })
}

export function encodeScopeDrawOnly(input: {
  readonly roleKey?: Hex
  readonly luckyDraw?: Address
} = {}): { readonly scopeTarget: Hex; readonly allowFunction: Hex } {
  const roleKey = input.roleKey ?? LUCKY_DRAW_ROLE_KEY
  const luckyDraw = (input.luckyDraw ?? MONAD_ACTIVATION_CONFIG.luckyDraw) as Address
  return {
    scopeTarget: encodeFunctionData({
      abi: ROLES_CONFIG_ABI,
      functionName: 'scopeTarget',
      args: [roleKey, luckyDraw]
    }),
    allowFunction: encodeFunctionData({
      abi: ROLES_CONFIG_ABI,
      functionName: 'allowFunction',
      args: [roleKey, luckyDraw, LUCKY_DRAW_DRAW_SELECTOR, EXECUTION_OPTIONS_NONE]
    })
  }
}

export function encodeAssignDrawRole(sessionAddress: Address, roleKey: Hex = LUCKY_DRAW_ROLE_KEY): Hex {
  return encodeFunctionData({
    abi: ROLES_CONFIG_ABI,
    functionName: 'assignRoles',
    args: [sessionAddress, [roleKey], [true]]
  })
}

/** Session Key EOA calls Roles.execTransactionWithRole for LuckyDraw.draw(). */
export function encodeExecDrawWithRole(input: {
  readonly luckyDraw?: Address
  readonly roleKey?: Hex
} = {}): Hex {
  const luckyDraw = (input.luckyDraw ?? MONAD_ACTIVATION_CONFIG.luckyDraw) as Address
  const roleKey = input.roleKey ?? LUCKY_DRAW_ROLE_KEY
  return encodeFunctionData({
    abi: ROLES_CONFIG_ABI,
    functionName: 'execTransactionWithRole',
    args: [
      luckyDraw,
      0n,
      LUCKY_DRAW_DRAW_SELECTOR,
      0, // Call
      roleKey,
      true
    ]
  })
}

export function buildRolesDrawTransaction(input: {
  readonly rolesModifier: Address
  readonly luckyDraw?: Address
}): { readonly to: Address; readonly value: bigint; readonly data: Hex } {
  return {
    to: input.rolesModifier,
    value: 0n,
    data: encodeExecDrawWithRole({ luckyDraw: input.luckyDraw })
  }
}

/** Assert a Roles draw tx matches the fixed LuckyDraw.draw() permission boundary. */
export function assertRolesDrawTransaction(input: {
  readonly to: string
  readonly value: bigint
  readonly data: Hex
  readonly rolesModifier: string
}): void {
  if (input.to.toLowerCase() !== input.rolesModifier.toLowerCase()) {
    throw new Error('roles draw must target the Roles modifier')
  }
  if (input.value !== 0n) throw new Error('roles draw value must be zero')
  const expected = encodeExecDrawWithRole()
  if (input.data.toLowerCase() !== expected.toLowerCase()) {
    throw new Error('roles draw calldata is not the fixed execTransactionWithRole(draw)')
  }
}
