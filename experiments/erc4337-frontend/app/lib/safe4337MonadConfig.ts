export const MONAD_TESTNET_CHAIN_ID = 10143
export const MONAD_ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'
export const MONAD_SAFE_4337_MODULE = '0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226'
export const MONAD_SAFE_V141 = '0x41675C099F32341bf84BFc5382aF534df5C7461a'

export type MonadSafe4337LearningCase = {
  label: string
  target: string
  value: '0'
  calldata: string
  preSendChecks: readonly string[]
}

export type MonadSafe4337LearningCaseStatus = {
  ready: false
  status: 'learning-only'
  message: string
}

export const MONAD_SAFE_4337_ZERO_VALUE_LEARNING_CASE: MonadSafe4337LearningCase = {
  label: '预设零值 UserOperation 学习案例',
  target: '未设置（不使用真实 Safe 地址）',
  value: '0',
  calldata: '空 calldata（不生成真实 calldata）',
  preSendChecks: [
    '确认 Safe 已存在',
    '取得 Owner 明确签名',
    '完成 Bundler 模拟',
    '确认 Paymaster policy，或准备自付 gas'
  ]
}

export function getMonadSafe4337LearningCaseStatus(): MonadSafe4337LearningCaseStatus {
  return {
    ready: false,
    status: 'learning-only',
    message: '这是预设学习案例：未签名、未模拟、未发送，不可发送。'
  }
}

export type MonadSafe4337Readiness =
  | { ready: false; message: string }
  | { ready: true; bundlerUrl: string; paymasterUrl: string }

export function getMonadSafe4337Readiness(pimlicoApiKey: string | undefined): MonadSafe4337Readiness {
  if (!pimlicoApiKey?.trim()) {
    return {
      ready: false,
      message: '请先设置 NUXT_PUBLIC_MONAD_PIMLICO_API_KEY，才可发送 Monad Safe UserOperation。'
    }
  }

  const query = new URLSearchParams([['apikey', pimlicoApiKey.trim()]]).toString()
  const endpoint = `https://api.pimlico.io/v2/10143/rpc?${query}`
  return { ready: true, bundlerUrl: endpoint, paymasterUrl: endpoint }
}
