import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import App from '../src/App.vue'

describe('ERC-4337 frontend app', () => {
  it('renders the wallet panel and the three experiment cards', () => {
    render(App)

    expect(screen.getByRole('heading', { name: /Monad ERC-4337/i })).toBeInTheDocument()
    expect(screen.getByText(/连接钱包后可以读取 Monad Testnet/)).toBeInTheDocument()
    expect(screen.getAllByText('Counterfactual / initCode').length).toBeGreaterThan(0)
    expect(screen.getByText('Paymaster / sponsored UserOp')).toBeInTheDocument()
    expect(screen.getByText('Session Key / 受限权限')).toBeInTheDocument()
  })

  it('switches the proof panel when an experiment card is selected', async () => {
    render(App)

    await fireEvent.click(screen.getByText('Paymaster / sponsored UserOp'))

    expect(screen.getByText(/Paymaster 向 EntryPoint deposit/)).toBeInTheDocument()
    expect(screen.getByText(/Paymaster deposit 余额 = 0.2776184 MON/)).toBeInTheDocument()
  })

  it('advances a practical initCode application scenario without sending a transaction', async () => {
    render(App)

    expect(screen.getByText('新用户领取活动徽章')).toBeInTheDocument()
    expect(screen.getByText('仅模拟流程，不发送链上交易')).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: '开始模拟领取' }))
    expect(screen.getByText('账户地址已预测，合约代码尚未部署')).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: '继续：向未来地址预充值' }))
    await fireEvent.click(screen.getByRole('button', { name: '继续：点击领取徽章并签名' }))
    await fireEvent.click(screen.getByRole('button', { name: '继续：部署账户并执行领取' }))

    expect(screen.getByText('模拟完成：账户已部署并领取成功')).toBeInTheDocument()
    expect(screen.getByText('EntryPoint 先部署账户，再执行领取徽章')).toBeInTheDocument()
  })
})
