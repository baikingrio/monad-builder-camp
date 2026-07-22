import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import IndexPage from '../app/pages/index.vue'

afterEach(cleanup)

describe('Monad Lucky Draw 首页', () => {
  function renderPage() {
    return render(IndexPage)
  }

  it('明确标示 Monad Testnet 与演示的安全边界', () => {
    renderPage()

    expect(screen.getByText('Monad Testnet')).toBeTruthy()
    expect(screen.getByText(/仅限测试网.*不涉及真实资产/)).toBeTruthy()
    expect(screen.getByText(/仅在点击.*后才会请求登录签名/)).toBeTruthy()
  })

  it('在用户请求检查前将 Safe 部署状态如实标示为未知', () => {
    renderPage()

    expect(screen.getByText('反事实 Safe')).toBeTruthy()
    expect(screen.getByText('未知（尚未检查）')).toBeTruthy()
    expect(screen.getByText(/Safe 地址派生不等于部署/)).toBeTruthy()
  })

  it('禁用模拟激活并抽卡预览，并明确不签名或发送', () => {
    renderPage()

    const button = screen.getByRole('button', { name: /模拟激活并抽卡/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText(/此预览不签名、不发送、不部署 Safe，也不会联系 Bundler 或 Sponsor/)).toBeTruthy()
    expect(screen.getByText(/真实激活仍已禁用.*不会请求签名、调用 Bundler 或广播 UserOperation/)).toBeTruthy()
  })

  it('不展示 UserOperation、交易哈希成功文本或任何成功链接', () => {
    const { container } = renderPage()

    expect(screen.queryByText(/UserOperation 成功|交易已确认|交易哈希：/)).toBeNull()
    expect(container.querySelector('a[href*="monadvision"]')).toBeNull()
  })

  it('在 Session Key 链上授权前禁用后续免弹窗抽奖', () => {
    renderPage()

    const button = screen.getByRole('button', { name: /免弹窗抽奖/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText(/需要 Session Key 链上授权；当前未实现/)).toBeTruthy()
  })

  it('清楚区分官方水龙头与本应用，不提供自建领币', () => {
    renderPage()

    expect(screen.getByText(/测试代币请使用 Monad 官方水龙头/)).toBeTruthy()
    expect(screen.getByText(/本应用不提供水龙头、不保管私钥、不发送测试币/)).toBeTruthy()
  })
})
