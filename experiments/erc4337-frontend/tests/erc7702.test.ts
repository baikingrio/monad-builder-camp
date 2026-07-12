import { describe, expect, it } from 'vitest'
import {
  EIP7702_DELEGATED_EOA,
  EIP7702_EXECUTOR,
  EIP7702_RELAYER,
  EIP7702_TARGET,
  EIP7702_TYPE04_TX_HASH,
  erc7702ExecutorAbi,
  erc7702TargetAbi
} from '../app/lib/erc7702'

describe('Monad Testnet ERC-7702 proof catalogue', () => {
  it('contains the real delegated EOA, fixed relayer, target, executor and type-0x04 transaction', () => {
    expect(EIP7702_DELEGATED_EOA).toBe('0x7c0343c808B827e4286381c2292d92c3f19152a4')
    expect(EIP7702_RELAYER).toBe('0xa88039b02B624184F13A46FFf0CBE23f4ccBAC28')
    expect(EIP7702_TARGET).toBe('0x8777d8DF77eD81c2bf17feAAe7F086eEF9f2517A')
    expect(EIP7702_EXECUTOR).toBe('0x697b1971AC691d20693e98FC503999F0Cb2bB493')
    expect(EIP7702_TYPE04_TX_HASH).toBe('0x46d56e952b2b737ec02caf9e80751e098ecca08f04356df74805d7418008fec4')
  })

  it('exposes only the read ABI needed by the public on-chain status panel', () => {
    expect(erc7702TargetAbi.map(item => item.name)).toEqual(['checkInCount', 'lastActor'])
    expect(erc7702ExecutorAbi.map(item => item.name)).toEqual(['relayer', 'target'])
  })
})
