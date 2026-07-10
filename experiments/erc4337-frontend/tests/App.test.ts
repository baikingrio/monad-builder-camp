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
})
