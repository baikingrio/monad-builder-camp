import { describe, expect, it } from 'vitest'
import {
  advanceSimulation,
  createSimulationState,
  getScenario,
  simulationScenarios
} from '../app/lib/simulation'

describe('ERC-4337 application scenario simulation', () => {
  it('provides one practical scenario for each completed experiment', () => {
    expect(simulationScenarios.map((scenario) => scenario.experimentId)).toEqual([
      'counterfactual-initcode',
      'sponsored-paymaster',
      'session-key'
    ])
    expect(getScenario('counterfactual-initcode').name).toBe('新用户领取活动徽章')
    expect(getScenario('sponsored-paymaster').name).toBe('免 Gas 的首次活动签到')
    expect(getScenario('session-key').name).toBe('链游每日签到')
  })

  it('simulates initCode deployment only when the user submits the first operation', () => {
    let state = createSimulationState('counterfactual-initcode')
    expect(state.currentStep).toBe(0)
    expect(state.completed).toBe(false)

    state = advanceSimulation(state)
    state = advanceSimulation(state)
    expect(state.timeline).toContain('账户地址已预测，合约代码尚未部署')

    state = advanceSimulation(state)
    state = advanceSimulation(state)
    expect(state.timeline).toContain('EntryPoint 先部署账户，再执行领取徽章')
    expect(state.completed).toBe(true)
  })

  it('keeps session-key restrictions visible after the check-in operation succeeds', () => {
    let state = createSimulationState('session-key')
    for (let index = 0; index < 4; index += 1) state = advanceSimulation(state)

    expect(state.completed).toBe(true)
    expect(state.timeline).toContain('限制仍然生效：不能转 MON，也不能调用其他合约')
    expect(advanceSimulation(state)).toEqual(state)
  })
})
