import { buildLoginMessage } from './authMessage'

export const MONAD_TESTNET_CHAIN_ID = 10143
export const MONAD_TESTNET_CHAIN_ID_HEX = `0x${MONAD_TESTNET_CHAIN_ID.toString(16)}` as const

const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const MONAD_TESTNET_ADD_CHAIN_PARAMS = Object.freeze({
  chainId: MONAD_TESTNET_CHAIN_ID_HEX,
  chainName: 'Monad Testnet',
  nativeCurrency: Object.freeze({ name: 'Monad', symbol: 'MON', decimals: 18 }),
  rpcUrls: Object.freeze(['https://testnet-rpc.monad.xyz']),
  blockExplorerUrls: Object.freeze(['https://testnet.monadvision.com'])
})

export type Eip1193LoginMethod =
  | 'eth_requestAccounts'
  | 'eth_chainId'
  | 'personal_sign'
  | 'wallet_switchEthereumChain'
  | 'wallet_addEthereumChain'

export interface Eip1193LoginProvider {
  request(args: {
    readonly method: Eip1193LoginMethod
    readonly params?: readonly unknown[]
  }): Promise<unknown>
  on?(event: 'accountsChanged' | 'chainChanged', listener: (value: unknown) => void): void
  removeListener?(event: 'accountsChanged' | 'chainChanged', listener: (value: unknown) => void): void
}

export interface LoginSnapshot {
  readonly account?: string
  readonly chainId?: number
  readonly authenticated: boolean
  readonly pending: boolean
  readonly error?: string
}

export interface EoaLoginController {
  readonly snapshot: LoginSnapshot
  connectAndLogin(): Promise<void>
  clear(): void
  dispose(): void
}

type FetchLike = (input: string, init?: { readonly method?: string; readonly headers?: Record<string, string>; readonly body?: string }) => Promise<{ readonly ok: boolean; json(): Promise<unknown> }>

function invalid(message: string): never { throw new Error(message) }
function accountFrom(value: unknown): string {
  if (!Array.isArray(value) || value.length !== 1 || typeof value[0] !== 'string' || !ADDRESS.test(value[0])) invalid('钱包必须返回一个有效 EOA 账户')
  return value[0].toLowerCase()
}
function chainFrom(value: unknown): number {
  if (typeof value !== 'string' || !/^0x[\da-f]+$/i.test(value)) invalid('钱包返回了无效链 ID')
  const chainId = Number.parseInt(value, 16)
  if (!Number.isSafeInteger(chainId)) invalid('钱包返回了无效链 ID')
  return chainId
}
function walletErrorCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || !error || !('code' in error)) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'number' ? code : undefined
}
function responseError(response: { readonly ok: boolean }): never { return invalid(response.ok ? '服务器返回了无效登录响应' : '服务器拒绝了登录请求') }
function messageFor(error: unknown): string {
  if (walletErrorCode(error) === 4001) return '用户取消了钱包请求'
  return error instanceof Error ? error.message : '钱包登录失败'
}

/** Ask the wallet to use Monad Testnet; add the chain first when the wallet does not know it yet. */
async function ensureMonadTestnet(provider: Eip1193LoginProvider): Promise<number> {
  let chainId = chainFrom(await provider.request({ method: 'eth_chainId' }))
  if (chainId === MONAD_TESTNET_CHAIN_ID) return chainId

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MONAD_TESTNET_CHAIN_ID_HEX }]
    })
  } catch (error) {
    // 4902 = unrecognized chain; MetaMask also uses this nested under error.data / message variants.
    const code = walletErrorCode(error)
    const nested = typeof error === 'object' && error && 'data' in error
      ? walletErrorCode((error as { data?: unknown }).data)
      : undefined
    if (code !== 4902 && nested !== 4902) throw error

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [MONAD_TESTNET_ADD_CHAIN_PARAMS]
    })
  }

  chainId = chainFrom(await provider.request({ method: 'eth_chainId' }))
  if (chainId !== MONAD_TESTNET_CHAIN_ID) {
    invalid('请在钱包弹窗中确认切换到 Monad Testnet（Chain ID 10143）后再登录')
  }
  return chainId
}

/**
 * Browser-only EIP-1193 login boundary. It can request accounts, chain ID / switch,
 * and an EIP-191 `personal_sign` authentication message; it has no transaction,
 * Safe, UserOperation, Sponsor, or RPC execution capability.
 */
export function createEoaLoginController(input: { provider?: Eip1193LoginProvider; fetch: FetchLike; origin: string; onChange?: (snapshot: LoginSnapshot) => void }): EoaLoginController {
  let value: LoginSnapshot = { authenticated: false, pending: false }
  const publish = (next: LoginSnapshot) => { value = Object.freeze(next); input.onChange?.(value) }
  const clear = () => publish({ authenticated: false, pending: false })
  const invalidate = () => clear()
  const accountsChanged = () => invalidate()
  const chainChanged = () => invalidate()
  input.provider?.on?.('accountsChanged', accountsChanged)
  input.provider?.on?.('chainChanged', chainChanged)

  return {
    get snapshot() { return value },
    clear,
    dispose() {
      input.provider?.removeListener?.('accountsChanged', accountsChanged)
      input.provider?.removeListener?.('chainChanged', chainChanged)
    },
    async connectAndLogin() {
      const provider = input.provider
      if (!provider) { publish({ authenticated: false, pending: false, error: '未检测到浏览器钱包' }); return }
      publish({ authenticated: false, pending: true })
      try {
        const account = accountFrom(await provider.request({ method: 'eth_requestAccounts' }))
        const chainId = await ensureMonadTestnet(provider)

        const nonceResponse = await input.fetch(`/api/auth/nonce?${new URLSearchParams({ eoa: account, origin: input.origin })}`)
        if (!nonceResponse.ok) responseError(nonceResponse)
        const noncePayload = await nonceResponse.json() as { nonce?: unknown; issuedAt?: unknown; expiresAt?: unknown; message?: unknown }
        if (typeof noncePayload.nonce !== 'string' || typeof noncePayload.issuedAt !== 'string' || typeof noncePayload.expiresAt !== 'string' || typeof noncePayload.message !== 'string') invalid('服务器返回了无效登录响应')
        const message = buildLoginMessage({ eoa: account, nonce: noncePayload.nonce, origin: input.origin, issuedAt: noncePayload.issuedAt, expiresAt: noncePayload.expiresAt }).text
        if (message !== noncePayload.message) invalid('服务器登录消息不匹配')

        const signature = await provider.request({ method: 'personal_sign', params: [message, account] })
        if (typeof signature !== 'string' || !/^0x[\da-f]+$/i.test(signature)) invalid('钱包返回了无效签名')
        const verifyResponse = await input.fetch('/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eoa: account, origin: input.origin, nonce: noncePayload.nonce, message, signature }) })
        if (!verifyResponse.ok) responseError(verifyResponse)
        const verified = await verifyResponse.json() as { authenticated?: unknown; eoa?: unknown }
        if (verified.authenticated !== true || typeof verified.eoa !== 'string' || verified.eoa.toLowerCase() !== account) invalid('服务器未验证此 EOA 登录')
        publish({ account, chainId, authenticated: true, pending: false })
      } catch (error) {
        publish({ authenticated: false, pending: false, error: messageFor(error) })
      }
    }
  }
}
