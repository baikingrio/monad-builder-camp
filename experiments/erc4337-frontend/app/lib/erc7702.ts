import type { Address, Hash } from 'viem'

/** Monad Testnet 上已真实完成的 ERC-7702 委托 EOA。 */
export const EIP7702_DELEGATED_EOA = '0x7c0343c808B827e4286381c2292d92c3f19152a4' as const satisfies Address
/** 真实 type-0x04 交易的 Gas 支付与提交账户；执行器只接受它调用。 */
export const EIP7702_RELAYER = '0xa88039b02B624184F13A46FFf0CBE23f4ccBAC28' as const satisfies Address
/** 记录两次真实 check-in 的 Monad Testnet 合约。 */
export const EIP7702_TARGET = '0x8777d8DF77eD81c2bf17feAAe7F086eEF9f2517A' as const satisfies Address
/** 被委托 EOA 指向的受限执行器。 */
export const EIP7702_EXECUTOR = '0x697b1971AC691d20693e98FC503999F0Cb2bB493' as const satisfies Address
/** 真正提交 authorization_list 并执行 runDemo() 的 type-0x04 交易。 */
export const EIP7702_TYPE04_TX_HASH = '0x46d56e952b2b737ec02caf9e80751e098ecca08f04356df74805d7418008fec4' as const satisfies Hash

/** 仅包含前端公开读取所需的 Target ABI，不提供浏览器写入入口。 */
export const erc7702TargetAbi = [
  { type: 'function', name: 'checkInCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'lastActor', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }
] as const

/** 读取执行器 immutable 配置，用于把链上状态与 UI 说明交叉验证。 */
export const erc7702ExecutorAbi = [
  { type: 'function', name: 'relayer', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'target', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }
] as const
