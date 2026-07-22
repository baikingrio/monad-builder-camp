export interface Eip1193Provider {
  request(args: { readonly method: 'eth_requestAccounts' | 'eth_chainId' }): Promise<unknown>
}

export interface BrowserEoaConnector {
  requestAccounts(): Promise<readonly string[]>
  requestChainId(): Promise<number>
}

const ADDRESS = /^0x[a-fA-F0-9]{40}$/

/** A deliberately narrow browser wallet surface: no signing, sending, or generic RPC. */
export function createBrowserEoaConnector(provider: Eip1193Provider): BrowserEoaConnector {
  return Object.freeze({
    async requestAccounts(): Promise<readonly string[]> {
      const result = await provider.request({ method: 'eth_requestAccounts' })
      if (!Array.isArray(result) || result.some((account) => typeof account !== 'string' || !ADDRESS.test(account))) {
        throw new Error('wallet returned invalid accounts')
      }
      return Object.freeze([...result])
    },
    async requestChainId(): Promise<number> {
      const result = await provider.request({ method: 'eth_chainId' })
      if (typeof result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(result)) throw new Error('wallet returned invalid chain id')
      const chainId = Number.parseInt(result, 16)
      if (!Number.isSafeInteger(chainId)) throw new Error('wallet returned unsafe chain id')
      return chainId
    }
  })
}

export type WalletRequestStatus = 'idle' | 'requesting' | 'connected' | 'rejected'
export interface WalletRequestState {
  readonly status: WalletRequestStatus
  readonly account?: string
  /** Connection is never proof of a signature-based login. */
  readonly cryptographicallyAuthenticated: false
}
export type WalletRequestEvent =
  | { readonly type: 'requestStarted' }
  | { readonly type: 'accountsResolved'; readonly accounts: readonly string[] }
  | { readonly type: 'requestRejected' }
  | { readonly type: 'cleared' }

export function createWalletRequestState(): WalletRequestState {
  return { status: 'idle', cryptographicallyAuthenticated: false }
}

export function transitionWalletRequestState(state: WalletRequestState, event: WalletRequestEvent): WalletRequestState {
  if (event.type === 'cleared') return createWalletRequestState()
  if (event.type === 'requestStarted') {
    if (state.status === 'requesting') throw new Error('wallet request is already pending')
    return { status: 'requesting', cryptographicallyAuthenticated: false }
  }
  if (state.status !== 'requesting') throw new Error('wallet accounts can only resolve while requesting')
  if (event.type === 'requestRejected') return { status: 'rejected', cryptographicallyAuthenticated: false }
  if (event.accounts.length !== 1) throw new Error('wallet must return exactly one valid account')
  const [account] = event.accounts
  if (!account || !ADDRESS.test(account)) throw new Error('wallet must return exactly one valid account')
  return { status: 'connected', account, cryptographicallyAuthenticated: false }
}
