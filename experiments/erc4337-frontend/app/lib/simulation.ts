import type { Experiment } from './erc4337Experiments'

export type SimulationStep = {
  actor: string
  title: string
  description: string
  timelineEntry: string
}

export type SimulationScenario = {
  experimentId: Experiment['id']
  name: string
  context: string
  startLabel: string
  completeLabel: string
  steps: SimulationStep[]
}

export type SimulationState = {
  experimentId: Experiment['id']
  currentStep: number
  completed: boolean
  timeline: string[]
}

export const simulationScenarios: SimulationScenario[] = [
  {
    experimentId: 'counterfactual-initcode',
    name: '新用户领取活动徽章',
    context: '用户刚进入 Monad 活动页，还没有部署智能账户，但活动方希望先给他一个可收款、可接收空投的地址。',
    startLabel: '开始模拟领取',
    completeLabel: '模拟完成：账户已部署并领取成功',
    steps: [
      {
        actor: '活动 App',
        title: '预测未来智能账户地址',
        description: '根据 factory、EntryPoint、owner 和 salt 计算 CREATE2 地址，不需要先部署账户。',
        timelineEntry: '账户地址已预测，合约代码尚未部署'
      },
      {
        actor: '活动方',
        title: '向未来地址预充值',
        description: '向这个地址发送 0.2 MON 或活动资产；地址可收款，即使 code.length 仍为 0。',
        timelineEntry: '未来账户已收到预充值，余额等待账户部署后继续使用'
      },
      {
        actor: '用户',
        title: '点击领取徽章并签名',
        description: '前端构造第一笔 UserOperation：sender 是预测地址，initCode 告诉 EntryPoint 怎样部署账户。',
        timelineEntry: '用户已签名第一笔 UserOperation，initCode 已随请求发送'
      },
      {
        actor: 'EntryPoint',
        title: '部署账户并执行领取',
        description: 'EntryPoint 先调用 factory 部署智能账户，再让账户执行领取徽章动作，两步在同一条 UserOperation 流程完成。',
        timelineEntry: 'EntryPoint 先部署账户，再执行领取徽章'
      }
    ]
  },
  {
    experimentId: 'sponsored-paymaster',
    name: '免 Gas 的首次活动签到',
    context: '新用户没有 MON，但活动方希望他第一次签到时无需先领测试币或购买 Gas。',
    startLabel: '开始模拟免 Gas 签到',
    completeLabel: '模拟完成：签到已由 Paymaster 赞助',
    steps: [
      {
        actor: '活动方',
        title: '给 Paymaster 准备 Gas 预算',
        description: '活动方先向 EntryPoint 中的 Paymaster deposit 充值 MON，并设置活动规则与赞助额度。',
        timelineEntry: 'Paymaster deposit 已准备，活动方开始承担符合规则的 Gas'
      },
      {
        actor: '用户',
        title: '点击签到并签名授权',
        description: '用户仍然必须签名自己的 UserOperation；Paymaster 只负责付费，不会代替用户授权。',
        timelineEntry: '用户已签名签到 UserOperation，授权与 Gas 赞助保持分离'
      },
      {
        actor: 'EntryPoint',
        title: '验证账户和赞助规则',
        description: 'EntryPoint 先验账户签名，再让 Paymaster 检查 sender、活动 ID、额度和 paymasterAndData。',
        timelineEntry: '账户签名和 Paymaster 赞助规则均已通过验证'
      },
      {
        actor: 'Paymaster',
        title: '赞助 Gas，签到成功',
        description: 'UserOperation 被执行，Gas 从 Paymaster deposit 扣除，用户无需持有 MON 才能完成第一次签到。',
        timelineEntry: '签到成功，UserOperation Gas 已从 Paymaster deposit 扣除'
      }
    ]
  },
  {
    experimentId: 'session-key',
    name: '链游每日签到',
    context: '用户已授权一个只适用于每日签到的临时 Session Key，希望减少重复的钱包弹窗，但不交出完整账户权限。',
    startLabel: '开始模拟每日签到',
    completeLabel: '模拟完成：签到成功，受限权限仍生效',
    steps: [
      {
        actor: '用户 / Owner',
        title: '授权受限 Session Key',
        description: '账户只允许此密钥在限定时间内调用指定 SessionKeyDemoTarget 的 checkIn(string)。',
        timelineEntry: 'Session Key 已授权：仅可调用白名单 checkIn(string)，nativeSpendLimit = 0'
      },
      {
        actor: '链游前端',
        title: '用 Session Key 构造签到请求',
        description: '前端签署 execute(target, 0, checkIn("daily-checkin"))，不需要再次请求 owner 钱包签名。',
        timelineEntry: '前端已用 Session Key 签名低风险签到 UserOperation'
      },
      {
        actor: '智能账户',
        title: '校验细粒度权限',
        description: 'validateUserOp 检查签名者、目标合约、函数 selector、有效期和花费额度。',
        timelineEntry: 'Session Key 校验通过：目标、函数、有效期与额度都符合限制'
      },
      {
        actor: '签到合约',
        title: '记录签到，不开放额外权限',
        description: 'checkInCount 增加；这次成功不代表密钥拥有转账或调用其他合约的能力。',
        timelineEntry: '限制仍然生效：不能转 MON，也不能调用其他合约'
      }
    ]
  }
]

export const getScenario = (experimentId: Experiment['id']) => {
  const scenario = simulationScenarios.find((item) => item.experimentId === experimentId)
  if (!scenario) throw new Error(`Missing simulation scenario for ${experimentId}`)
  return scenario
}

export const createSimulationState = (experimentId: Experiment['id']): SimulationState => ({
  experimentId,
  currentStep: 0,
  completed: false,
  timeline: []
})

export const advanceSimulation = (state: SimulationState): SimulationState => {
  const scenario = getScenario(state.experimentId)
  if (state.completed) return state

  const step = scenario.steps[state.currentStep]
  const currentStep = state.currentStep + 1
  return {
    ...state,
    currentStep,
    completed: currentStep === scenario.steps.length,
    timeline: [...state.timeline, step.timelineEntry]
  }
}
