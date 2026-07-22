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
  it('验证已派生但尚未部署的 Safe 时，明确说明仍待链上部署确认', () => {
    render(SafeStatusCard, {
      props: {
        state: stateWith({
          status: 'safeDerived',
          authenticated: true,
          safeDerivationVerified: true
        })
      }
    })

    expect(screen.getByText('未部署')).toBeTruthy()
    expect(screen.getByText('Safe 已派生待部署；部署状态仍须由链上确认。')).toBeTruthy()
  })

  it('only displays a derived address as counterfactual and not deployed', () => {
    render(SafeStatusCard, {
      props: {
        state: stateWith({
          status: 'safeDerived', authenticated: true, safeDerivationVerified: true,
          counterfactualSafeAddress: '0x7B230f5FcE1f5A2912759C6339C9Dc5fdb3f427C'
        })
      }
    })

    expect(screen.getByText('反事实地址（未部署）')).toBeTruthy()
    expect(screen.getByText('0x7B230f5FcE1f5A2912759C6339C9Dc5fdb3f427C')).toBeTruthy()
  })

  it('已确认部署的 Safe 不会被描述为待部署', () => {
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

    expect(screen.getByText('已部署')).toBeTruthy()
    expect(screen.getByText('Safe 已确认部署；链上部署状态已确认。')).toBeTruthy()
    expect(screen.queryByText('Safe 已派生待部署；部署状态仍须由链上确认。')).toBeNull()
  })

  it('首次抽奖前置条件就绪时仍禁用预览按钮，并说明 UserOperation 集成待完成', () => {
    render(DrawResultCard, {
      props: {
        state: stateWith({ status: 'activationReady' }),
        firstDrawAvailable: true
      }
    })

    const button = screen.getByRole('button', { name: /首次赞助激活并抽奖/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText('前置条件已就绪；实际 UserOperation 集成仍待完成，当前不会创建 UserOperation。')).toBeTruthy()
  })

  it('首次抽奖前置条件未就绪时，同样禁用预览按钮并如实说明限制', () => {
    render(DrawResultCard, {
      props: {
        state: stateWith({ status: 'safeDerived' }),
        firstDrawAvailable: false
      }
    })

    const button = screen.getByRole('button', { name: /首次赞助激活并抽奖/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText('登录、Safe 验证与 Sponsor 就绪后才能准备实际 UserOperation；当前界面预览不会创建 UserOperation。')).toBeTruthy()
  })
})
