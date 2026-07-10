import { defineChain } from 'viem'

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] }
  },
  blockExplorers: {
    default: { name: 'MonadVision', url: 'https://testnet.monadvision.com' }
  },
  testnet: true
})

export const ENTRY_POINT_V08 = '0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108' as const

export type Experiment = {
  id: 'counterfactual-initcode' | 'sponsored-paymaster' | 'session-key'
  title: string
  shortTitle: string
  status: '已完成链上实验'
  summary: string
  howItWorks: string
  result: string
  contractAddress: `0x${string}`
  transactionHash: `0x${string}`
  proofs: string[]
}

const explorerTx = (hash: string) => `https://testnet.monadvision.com/tx/${hash}`

export const experiments: Experiment[] = [
  {
    id: 'counterfactual-initcode',
    title: 'Counterfactual / initCode',
    shortTitle: '提前拥有账户地址，首次操作再部署',
    status: '已完成链上实验',
    summary: '用 CREATE2 预测智能账户地址，先预充值，第一次 UserOperation 通过 initCode 部署账户并执行操作。',
    howItWorks: 'EntryPoint 从 initCode 读取 factory 地址和 createAccount calldata，先部署 sender，再调用账户的 execute。',
    result: '账户部署成功，EntryPoint nonce = 1，账户余额 = 0.083 MON。',
    contractAddress: '0x225b0Ab837621F548a86FE7B8D65a4A60079760B',
    transactionHash: '0x07e26e0a94d9a48f7233e67d07fcd8f1f5f2b18edeadfd2fdd9bbf91bbebf380',
    proofs: [
      'handleOps tx: 0x07e26e0a94d9a48f7233e67d07fcd8f1f5f2b18edeadfd2fdd9bbf91bbebf380',
      'initCode: 120 bytes',
      'EntryPoint nonce: 1'
    ]
  },
  {
    id: 'sponsored-paymaster',
    title: 'Paymaster / sponsored UserOp',
    shortTitle: '项目方在规则内赞助用户 Gas',
    status: '已完成链上实验',
    summary: 'Paymaster 向 EntryPoint deposit 预存 MON，用户继续签名授权，UserOperation 的 Gas 从 Paymaster deposit 扣除。',
    howItWorks: 'paymasterAndData 携带 Paymaster 地址、Gas 限额和活动标识；EntryPoint 会验证账户签名及 Paymaster 的赞助规则。',
    result: 'Sponsored UserOperation 成功，nonce = 1，Paymaster deposit 余额 = 0.2776184 MON。',
    contractAddress: '0x0DF510267FE287e0bf7724F28AFA07Ed755B1c96',
    transactionHash: '0x44b2c02374367f43ab006be28b524ba32c3a75d9b65b4c34ea3811eeaef86b4d',
    proofs: [
      'handleOps tx: 0x44b2c02374367f43ab006be28b524ba32c3a75d9b65b4c34ea3811eeaef86b4d',
      'paymasterAndData: 83 bytes',
      'EntryPoint nonce: 1'
    ]
  },
  {
    id: 'session-key',
    title: 'Session Key / 受限权限',
    shortTitle: '临时密钥只做被授权的低风险动作',
    status: '已完成链上实验',
    summary: 'Session key 仅能调用指定目标的 checkIn(string)，不能转 MON、不能调用其他合约或函数。',
    howItWorks: '账户在 validateUserOp 中校验签名者、目标合约、函数 selector、有效期和 native spend limit。',
    result: 'session key 交易成功，checkInCount = 1，nativeSpent = 0。',
    contractAddress: '0xc01c4864631f8A23cBc2f59B8F1c3Eaa48dA4AD3',
    transactionHash: '0x1b40ca3f39e74b859d917bd927d3efee7c12484a54ce5610c6a9ec41d9bc224d',
    proofs: [
      'handleOps tx: 0x1b40ca3f39e74b859d917bd927d3efee7c12484a54ce5610c6a9ec41d9bc224d',
      'checkInCount: 1',
      'nativeSpent: 0'
    ]
  }
]

export const getExperimentById = (id: Experiment['id']) => experiments.find((experiment) => experiment.id === id)
export const getExplorerTxUrl = (hash: string) => explorerTx(hash)
export const getExplorerAddressUrl = (address: string) => `https://testnet.monadvision.com/address/${address}`
