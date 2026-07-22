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
          counterfactualSafeAddress: '0x7B230f5FcE1f5A2912759C6339C9Dc5fdb3f427C'
        })
      }
    })

    expect(screen.getByText('反事实 Safe 地址')).toBeTruthy()
    expect(screen.getByText('0x7B230f5FcE1f5A2912759C6339C9Dc5fdb3f427C')).toBeTruthy()
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

  it('首次抽奖前置条件就绪时仍禁用模拟预览按钮，并说明不会执行', () => {
    render(DrawResultCard, {
      props: {
        state: stateWith({ status: 'activationReady' }),
        firstDrawAvailable: true
      }
    })

    const button = screen.getByRole('button', { name: /模拟激活并抽卡/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText(/此预览不签名、不发送、不部署 Safe，也不会联系 Bundler 或 Sponsor/)).toBeTruthy()
  })

  it('首次抽奖前置条件未就绪时，同样禁用模拟预览按钮并如实说明限制', () => {
    render(DrawResultCard, {
      props: {
        state: stateWith({ status: 'safeDerived' }),
        firstDrawAvailable: false
      }
    })

    const button = screen.getByRole('button', { name: /模拟激活并抽卡/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText(/此预览不签名、不发送、不部署 Safe，也不会联系 Bundler 或 Sponsor/)).toBeTruthy()
  })
})
