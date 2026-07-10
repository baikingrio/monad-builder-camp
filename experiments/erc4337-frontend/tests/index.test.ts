import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import IndexPage from '../app/pages/index.vue'

describe('Nuxt index page', () => {
  it('renders the wallet panel and the three experiment cards', () => {
    render(IndexPage)

    expect(screen.getByRole('heading', { name: /Monad ERC-4337/i })).toBeInTheDocument()
    expect(screen.getByText(/连接钱包后可以读取 Monad Testnet/)).toBeInTheDocument()
    expect(screen.getAllByText('Counterfactual / initCode').length).toBeGreaterThan(0)
    expect(screen.getByText('Paymaster / sponsored UserOp')).toBeInTheDocument()
    expect(screen.getByText('Session Key / 受限权限')).toBeInTheDocument()
  })

  it('switches experiment details and advances the browser-only simulation without sending a transaction', async () => {
    render(IndexPage)

    await fireEvent.click(screen.getByText('Paymaster / sponsored UserOp'))
    expect(screen.getByText(/Paymaster deposit 余额 = 0.2776184 MON/)).toBeInTheDocument()

    await fireEvent.click(screen.getByText('Counterfactual / initCode'))
    await fireEvent.click(screen.getByRole('button', { name: '开始模拟领取' }))
    expect(screen.getByText('账户地址已预测，合约代码尚未部署')).toBeInTheDocument()
  })
})
