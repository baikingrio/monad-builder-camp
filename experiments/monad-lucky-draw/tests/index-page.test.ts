import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import IndexPage from '../app/pages/index.vue'

vi.mock('#app', () => ({}))

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

  it('在 Sponsor 未就绪或 Safe 未确认前禁用激活按钮，并区分登录与链上授权', () => {
    renderPage()

    const button = screen.getByRole('button', { name: /激活并免费抽一次/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText(/登录签名不等于链上 AA 授权/)).toBeTruthy()
    expect(screen.getByText(/不会在未点击时请求签名或广播/)).toBeTruthy()
  })

  it('初始不展示 UserOperation 成功或 MonadVision 成功链接', () => {
    const { container } = renderPage()

    expect(screen.queryByText(/首次激活抽卡已上链确认/)).toBeNull()
    expect(container.querySelector('a[href*="monadvision"]')).toBeNull()
  })

  it('在 Session Key 链上授权前禁用免弹窗抽奖，并提供启用入口', () => {
    renderPage()

    const draw = screen.getByRole('button', { name: /^免弹窗抽奖$/ }) as HTMLButtonElement
    const enable = screen.getByRole('button', { name: /启用免弹窗抽奖/ }) as HTMLButtonElement
    expect(draw.disabled).toBe(true)
    expect(enable.disabled).toBe(true)
    expect(screen.getByText(/Session Key 在链上是 Safe owner/)).toBeTruthy()
  })

  it('清楚区分官方水龙头与本应用，不提供自建领币', () => {
    renderPage()

    expect(screen.getByText(/测试代币请使用 Monad 官方水龙头/)).toBeTruthy()
    expect(screen.getByText(/本应用不提供水龙头、不保管私钥、不发送测试币/)).toBeTruthy()
  })
})
