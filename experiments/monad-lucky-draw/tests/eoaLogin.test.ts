import { describe, expect, it, vi } from 'vitest'
import { buildLoginMessage } from '../app/lib/authMessage'
import {
  createEoaLoginController,
  MONAD_TESTNET_CHAIN_ID,
  MONAD_TESTNET_CHAIN_ID_HEX,
  type Eip1193LoginProvider
} from '../app/lib/eoaLogin'

const account = '0x1111111111111111111111111111111111111111'
const origin = 'https://lucky-draw.example'
const nonce = 'nonce-7f6d6f9e-9f2e-4b42-a889-123456789abc'
const issuedAt = '2026-07-22T10:00:00.000Z'
const expiresAt = '2026-07-22T10:05:00.000Z'
const message = buildLoginMessage({ eoa: account, nonce, origin, issuedAt, expiresAt }).text
const monadHex = MONAD_TESTNET_CHAIN_ID_HEX

function provider(overrides: Partial<Eip1193LoginProvider> = {}) {
  const listeners = new Map<string, (value: unknown) => void>()
  return {
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_requestAccounts') return [account]
      if (method === 'eth_chainId') return monadHex
      if (method === 'personal_sign') return `0x${'11'.repeat(65)}`
      throw new Error(`unexpected method: ${method}`)
    }),
    on: vi.fn((event: string, listener: (value: unknown) => void) => listeners.set(event, listener)),
    removeListener: vi.fn(),
    emit(event: string, value: unknown) { listeners.get(event)?.(value) },
    ...overrides
  } as Eip1193LoginProvider & { request: ReturnType<typeof vi.fn>; emit(event: string, value: unknown): void }
}
function fetchSuccess() {
  return vi.fn(async (url: string) => url.startsWith('/api/auth/nonce')
    ? { ok: true, json: async () => ({ nonce, issuedAt, expiresAt, message }) }
    : { ok: true, json: async () => ({ authenticated: true, eoa: account }) })
}

describe('user-clicked browser EOA login', () => {
  it('does not connect, sign, or call auth APIs before an explicit click', () => {
    const wallet = provider()
    const fetch = fetchSuccess()
    const controller = createEoaLoginController({ provider: wallet, fetch, origin })

    expect(wallet.request).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(controller.snapshot.authenticated).toBe(false)
  })

  it('uses the canonical server message exactly for personal_sign and server verification', async () => {
    const wallet = provider()
    const fetch = fetchSuccess()
    const controller = createEoaLoginController({ provider: wallet, fetch, origin })

    await controller.connectAndLogin()

    expect(wallet.request).toHaveBeenNthCalledWith(3, { method: 'personal_sign', params: [message, account] })
    expect(fetch).toHaveBeenNthCalledWith(1, `/api/auth/nonce?eoa=${account}&origin=${encodeURIComponent(origin)}`)
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/auth/verify', expect.objectContaining({ method: 'POST', body: JSON.stringify({ eoa: account, origin, nonce, message, signature: `0x${'11'.repeat(65)}` }) }))
    expect(controller.snapshot).toMatchObject({ authenticated: true, account, chainId: MONAD_TESTNET_CHAIN_ID })
  })

  it('switches to Monad Testnet when the wallet is on another chain', async () => {
    let onMonad = false
    const wallet = provider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return [account]
        if (method === 'eth_chainId') return onMonad ? monadHex : '0x1'
        if (method === 'wallet_switchEthereumChain') {
          onMonad = true
          return null
        }
        if (method === 'personal_sign') return `0x${'11'.repeat(65)}`
        throw new Error(`unexpected method: ${method}`)
      })
    })
    const fetch = fetchSuccess()
    const controller = createEoaLoginController({ provider: wallet, fetch, origin })

    await controller.connectAndLogin()

    expect(wallet.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: monadHex }]
    })
    expect(controller.snapshot).toMatchObject({ authenticated: true, chainId: MONAD_TESTNET_CHAIN_ID })
  })

  it('adds Monad Testnet when switch returns unrecognized chain (4902)', async () => {
    let onMonad = false
    const wallet = provider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return [account]
        if (method === 'eth_chainId') return onMonad ? monadHex : '0x1'
        if (method === 'wallet_switchEthereumChain') {
          throw Object.assign(new Error('Unrecognized chain'), { code: 4902 })
        }
        if (method === 'wallet_addEthereumChain') {
          onMonad = true
          return null
        }
        if (method === 'personal_sign') return `0x${'11'.repeat(65)}`
        throw new Error(`unexpected method: ${method}`)
      })
    })
    const controller = createEoaLoginController({ provider: wallet, fetch: fetchSuccess(), origin })

    await controller.connectAndLogin()

    expect(wallet.request).toHaveBeenCalledWith({
      method: 'wallet_addEthereumChain',
      params: [expect.objectContaining({ chainId: monadHex, chainName: 'Monad Testnet' })]
    })
    expect(controller.snapshot.authenticated).toBe(true)
  })

  it.each([
    ['missing provider', undefined as unknown as Eip1193LoginProvider],
    ['user rejection', provider({ request: vi.fn(async () => { throw Object.assign(new Error('rejected'), { code: 4001 }) }) })]
  ])('never authenticates on %s', async (_name, wallet) => {
    const fetch = fetchSuccess()
    const controller = createEoaLoginController({ provider: wallet, fetch, origin })
    await controller.connectAndLogin()
    expect(controller.snapshot.authenticated).toBe(false)
    expect(fetch.mock.calls.length).toBe(0)
  })

  it('never authenticates when the user rejects the chain switch', async () => {
    const wallet = provider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return [account]
        if (method === 'eth_chainId') return '0x1'
        if (method === 'wallet_switchEthereumChain') {
          throw Object.assign(new Error('rejected'), { code: 4001 })
        }
        throw new Error(`unexpected method: ${method}`)
      })
    })
    const fetch = fetchSuccess()
    const controller = createEoaLoginController({ provider: wallet, fetch, origin })
    await controller.connectAndLogin()
    expect(controller.snapshot.authenticated).toBe(false)
    expect(controller.snapshot.error).toBe('用户取消了钱包请求')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('clears the authenticated UI session when the wallet account or chain changes', async () => {
    const wallet = provider()
    const controller = createEoaLoginController({ provider: wallet, fetch: fetchSuccess(), origin })
    await controller.connectAndLogin()
    expect(controller.snapshot.authenticated).toBe(true)

    wallet.emit('accountsChanged', ['0x2222222222222222222222222222222222222222'])
    expect(controller.snapshot).toEqual({ authenticated: false, pending: false })
    await controller.connectAndLogin()
    wallet.emit('chainChanged', '0x1')
    expect(controller.snapshot).toEqual({ authenticated: false, pending: false })
  })

  it('never authenticates if nonce, signature, or server verification fails', async () => {
    const wallet = provider()
    const failedVerify = vi.fn(async (url: string) => url.startsWith('/api/auth/nonce')
      ? { ok: true, json: async () => ({ nonce, issuedAt, expiresAt, message }) }
      : { ok: true, json: async () => ({ authenticated: false }) })
    const controller = createEoaLoginController({ provider: wallet, fetch: failedVerify, origin })
    await controller.connectAndLogin()
    expect(controller.snapshot.authenticated).toBe(false)
    expect(controller.snapshot.error).toMatch(/服务器未验证/)
  })

  it('uses only account, chain, and EIP-191 signing wallet methods and only auth endpoints', async () => {
    const wallet = provider()
    const fetch = fetchSuccess()
    const controller = createEoaLoginController({ provider: wallet, fetch, origin })
    await controller.connectAndLogin()
    expect(wallet.request.mock.calls.map(([request]) => request.method)).toEqual(['eth_requestAccounts', 'eth_chainId', 'personal_sign'])
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([expect.stringMatching(/^\/api\/auth\/nonce\?/), '/api/auth/verify'])
  })
})
