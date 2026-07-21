import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import SafePasskeysPage from '../app/pages/safe-passkeys.vue'

describe('Safe passkey practice page', () => {
  it('clearly separates passkey creation from the explicit sponsored mint action', () => {
    vi.stubGlobal('useRoute', () => ({ query: {} }))
    vi.stubGlobal('useRouter', () => ({ replace: () => {} }))
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { pimlicoApiKey: '', monadPimlicoApiKey: '' } }))
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {}
    })

    render(SafePasskeysPage)

    expect(screen.getByRole('heading', { name: /Safe Passkeys/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '创建新的 Passkey' })).toBeInTheDocument()
    expect(screen.getByText(/仅在你点击「Mint NFT（会发送交易）」后才会请求签名并发送 UserOperation/)).toBeInTheDocument()
    expect(screen.getByText(/1\/1 Passkey Safe 只用于本次教程练习/)).toBeInTheDocument()
  })
})
