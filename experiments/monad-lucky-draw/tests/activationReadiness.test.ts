import { describe, expect, it, vi } from 'vitest'
import {
  MONAD_ACTIVATION_CONFIG,
  createMonadActivationConfig
} from '../app/lib/monadConfig'
import {
  createBrowserEoaConnector,
  createWalletRequestState,
  transitionWalletRequestState
} from '../app/lib/browserEoa'
import {
  createVerifiedOwnerAuthorization,
  evaluateActivationReadiness,
  type ActivationReadinessInput
} from '../app/lib/activationReadiness'
import { createActivationSimulationDraft, LUCKY_DRAW_CALLDATA } from '../app/lib/userOperationDraft'

const OWNER = '0x1111111111111111111111111111111111111111'
const SIGNATURE = `0x${'11'.repeat(65)}`

function readyInput(overrides: Partial<ActivationReadinessInput> = {}): ActivationReadinessInput {
  return {
    config: MONAD_ACTIVATION_CONFIG,
    ownerAuthorization: createVerifiedOwnerAuthorization({
      owner: OWNER,
      signature: SIGNATURE,
      cryptographicallyVerified: true
    }),
    sponsorPolicy: { persistent: true, authorized: true },
    userClicked: true,
    ...overrides
  }
}

describe('verified Monad activation configuration', () => {
  it('uses the verified chain, Safe factory, EntryPoint v0.7 and Lucky Draw addresses', () => {
    expect(MONAD_ACTIVATION_CONFIG).toEqual({
      chainId: 10143,
      safeFactory: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
      luckyDraw: '0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70'
    })
  })

  it('rejects malformed, zero, or changed activation endpoints', () => {
    expect(() => createMonadActivationConfig({ ...MONAD_ACTIVATION_CONFIG, chainId: 1 })).toThrow(/Monad Testnet/)
    expect(() => createMonadActivationConfig({ ...MONAD_ACTIVATION_CONFIG, entryPoint: '0x0000000000000000000000000000000000000000' })).toThrow(/EntryPoint/)
    expect(() => createMonadActivationConfig({ ...MONAD_ACTIVATION_CONFIG, luckyDraw: OWNER })).toThrow(/Lucky Draw/)
  })
})

describe('browser EOA connector abstraction', () => {
  it('only exposes account and chain requests, never a signature or transaction request', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce([OWNER])
      .mockResolvedValueOnce('0x279f')
    const connector = createBrowserEoaConnector({ request })

    await expect(connector.requestAccounts()).resolves.toEqual([OWNER])
    await expect(connector.requestChainId()).resolves.toBe(10143)
    expect(request.mock.calls).toEqual([
      [{ method: 'eth_requestAccounts' }],
      [{ method: 'eth_chainId' }]
    ])
    expect(Object.keys(connector)).not.toContain('signMessage')
    expect(Object.keys(connector)).not.toContain('sendTransaction')
  })

  it('tracks connection request state without treating a request as authenticated', () => {
    let state = createWalletRequestState()
    state = transitionWalletRequestState(state, { type: 'requestStarted' })
    expect(state.status).toBe('requesting')
    state = transitionWalletRequestState(state, { type: 'accountsResolved', accounts: [OWNER] })
    expect(state).toMatchObject({ status: 'connected', account: OWNER, cryptographicallyAuthenticated: false })
    expect(() => transitionWalletRequestState(state, { type: 'accountsResolved', accounts: [] })).toThrow(/requesting/)
  })
})

describe('activation construction and simulation safety gate', () => {
  it.each([
    ['missing cryptographic verification', { ownerAuthorization: createVerifiedOwnerAuthorization({ owner: OWNER, signature: SIGNATURE, cryptographicallyVerified: false }) }],
    ['non-persistent sponsor policy', { sponsorPolicy: { persistent: false, authorized: true } }],
    ['missing user click', { userClicked: false }]
  ])('is disabled for %s', (_name, overrides) => {
    const readiness = evaluateActivationReadiness(readyInput(overrides))
    expect(readiness.canConstructUserOperation).toBe(false)
    expect(() => createActivationSimulationDraft(readyInput(overrides))).toThrow(/not ready/)
  })

  it('constructs only a fixed, zero-value draw simulation draft after every gate passes', () => {
    const draft = createActivationSimulationDraft(readyInput())

    expect(evaluateActivationReadiness(readyInput()).canConstructUserOperation).toBe(true)
    expect(draft).toMatchObject({
      kind: 'activation-simulation-draft',
      owner: OWNER,
      target: MONAD_ACTIVATION_CONFIG.luckyDraw,
      value: 0n,
      callData: LUCKY_DRAW_CALLDATA,
      safeFactory: MONAD_ACTIVATION_CONFIG.safeFactory,
      entryPoint: MONAD_ACTIVATION_CONFIG.entryPoint
    })
    expect(draft.callData).toBe('0x35d1193c')
    expect(Object.keys(draft)).not.toContain('signature')
    expect(Object.keys(draft)).not.toContain('broadcast')
  })

  it('will not construct with altered draw calldata, non-zero value, or an unverified config', () => {
    expect(() => createActivationSimulationDraft(readyInput(), { callData: '0xdeadbeef' })).toThrow(/fixed Lucky Draw calldata/)
    expect(() => createActivationSimulationDraft(readyInput(), { value: 1n })).toThrow(/zero value/)
    expect(() => createActivationSimulationDraft(readyInput({ config: { ...MONAD_ACTIVATION_CONFIG, safeFactory: OWNER } }))).toThrow(/Safe factory/)
  })
})
