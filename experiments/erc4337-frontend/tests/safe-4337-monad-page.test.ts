import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Safe4337MonadPage from '../app/pages/safe-4337-monad.vue'

describe('Monad Safe 4337 page', () => {
  beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { monadPimlicoApiKey: '' } }))
  })

  it('identifies the supported Safe 4337 route without presenting Safe Passkey as officially supported', () => {
    render(Safe4337MonadPage)

    expect(screen.getByRole('heading', { name: /Safe 4337.*Monad/i })).toBeInTheDocument()
    expect(screen.getAllByText(/Safe 1\.4\.1.*Safe 4337 Module.*EntryPoint v0\.7/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Safe Passkey Module 目前不在 Monad Testnet 的官方支持列表/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '验证链上基础合约' })).toBeInTheDocument()
    expect(screen.getByText(/本页只读取公开链上代码，不创建 Safe、不请求签名、不发送 UserOperation/)).toBeInTheDocument()
  })

  it('shows an accessible zero-value UserOperation learning preset and its pre-send boundary', () => {
    render(Safe4337MonadPage)

    const learningCase = within(screen.getByRole('region', { name: '预设 UserOperation 学习案例' }))
    expect(learningCase.getByRole('heading', { name: '预设 UserOperation 学习案例' })).toBeInTheDocument()
    expect(learningCase.getByText('未设置（不使用真实 Safe 地址）')).toBeInTheDocument()
    expect(learningCase.getByText('0')).toBeInTheDocument()
    expect(learningCase.getByText(/空 calldata/i)).toBeInTheDocument()
    expect(learningCase.getByText(/Safe.*存在/i)).toBeInTheDocument()
    expect(learningCase.getByText(/Owner.*签名/i)).toBeInTheDocument()
    expect(learningCase.getByText(/Bundler.*模拟/i)).toBeInTheDocument()
    expect(learningCase.getByText(/Paymaster.*自付 gas/i)).toBeInTheDocument()
    expect(learningCase.getByText('这是预设学习案例：未签名、未模拟、未发送，不可发送。')).toBeInTheDocument()
  })
})
