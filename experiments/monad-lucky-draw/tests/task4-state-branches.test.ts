import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import DrawResultCard from '../app/components/DrawResultCard.vue'
import SafeStatusCard from '../app/components/SafeStatusCard.vue'
import { createDemoState, type DemoState } from '../app/lib/demoState'

afterEach(cleanup)

function stateWith(overrides: Partial<DemoState>): DemoState {
  return { ...createDemoState(), ...overrides }
}

describe('Task4 状态分支的诚实文案', () => {
  it('已派生 Safe 在用户检查前不作部署声明', () => {
    render(SafeStatusCard, {
      props: {
        state: stateWith({
          status: 'safeDerived',
          authenticated: true,
          safeDerivationVerified: true
        })
      }
    })

    expect(screen.getByText('未知（尚未检查）')).toBeTruthy()
    expect(screen.getByText(/Safe 地址派生不等于部署/)).toBeTruthy()
  })

  it('only displays a derived address as counterfactual without a deployment claim', () => {
    render(SafeStatusCard, {
      props: {
        state: stateWith({
          status: 'safeDerived', authenticated: true, safeDerivationVerified: true,
          counterfactualSafeAddress: '0x59cB895943D081a4b102aA22d19Eda1FabFD37d7'
        })
      }
    })

    expect(screen.getByText('反事实 Safe 地址')).toBeTruthy()
    expect(screen.getByText('0x59cB895943D081a4b102aA22d19Eda1FabFD37d7')).toBeTruthy()
  })

  it('不会从旧的 UI state 推断 Safe 已部署', () => {
    render(SafeStatusCard, {
      props: {
        state: stateWith({
          status: 'active',
          authenticated: true,
          safeDerivationVerified: true,
          safeDeployed: true
        })
      }
    })

    expect(screen.getByText('未知（尚未检查）')).toBeTruthy()
    expect(screen.queryByText('已部署（链上只读检查）')).toBeNull()
  })

  it('Sponsor 未启用时禁用激活按钮，并区分登录与链上授权', () => {
    render(DrawResultCard, {
      props: {
        state: stateWith({ status: 'activationReady', authenticated: true, safeDerivationVerified: true, safeDeploymentStatus: 'not-deployed', onMonadTestnet: true }),
        firstDrawAvailable: true,
        sponsorEnabled: false
      }
    })

    const button = screen.getByRole('button', { name: /激活并免费抽一次/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText(/登录签名不等于链上 AA 授权/)).toBeTruthy()
  })

  it('前置条件未齐时禁用激活按钮', () => {
    render(DrawResultCard, {
      props: {
        state: stateWith({ status: 'safeDerived' }),
        firstDrawAvailable: false,
        sponsorEnabled: true
      }
    })

    const button = screen.getByRole('button', { name: /激活并免费抽一次/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText(/不会在未点击时请求签名或广播/)).toBeTruthy()
  })
})
