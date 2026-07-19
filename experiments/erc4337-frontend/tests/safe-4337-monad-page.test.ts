import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import Safe4337MonadPage from '../app/pages/safe-4337-monad.vue'

describe('Monad Safe 4337 page', () => {
  it('identifies the supported Safe 4337 route without presenting Safe Passkey as officially supported', () => {
    render(Safe4337MonadPage)

    expect(screen.getByRole('heading', { name: /Safe 4337.*Monad/i })).toBeInTheDocument()
    expect(screen.getAllByText(/Safe 1\.4\.1.*Safe 4337 Module.*EntryPoint v0\.7/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Safe Passkey Module 目前不在 Monad Testnet 的官方支持列表/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '验证链上基础合约' })).toBeInTheDocument()
    expect(screen.getByText(/本页只读取公开链上代码，不创建 Safe、不请求签名、不发送 UserOperation/)).toBeInTheDocument()
  })
})
