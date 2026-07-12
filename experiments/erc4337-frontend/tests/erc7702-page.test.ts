import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import Erc7702Page from '../app/pages/erc7702.vue'

describe('ERC-7702 on-chain proof page', () => {
  it('renders the Monad Testnet real-proof boundary rather than a browser-only simulation', () => {
    render(Erc7702Page)

    expect(screen.getByRole('heading', { name: /ERC-7702 真实链上 Demo/i })).toBeInTheDocument()
    expect(screen.getByText(/已在 Monad Testnet 完成 type-0x04 交易/)).toBeInTheDocument()
    expect(screen.getByText(/前端只做公开链上读取，不保存私钥、不代替用户签名/)).toBeInTheDocument()
    expect(screen.queryByText(/浏览器本地模拟/)).not.toBeInTheDocument()
  })

  it('exposes public explorer links for the type-0x04 transaction and deployed contracts', () => {
    render(Erc7702Page)

    expect(screen.getByRole('link', { name: /查看 type-0x04 交易/i })).toHaveAttribute(
      'href',
      expect.stringContaining('0x46d56e952b2b737ec02caf9e80751e098ecca08f04356df74805d7418008fec4')
    )
    expect(screen.getByRole('link', { name: /查看 CheckIn Target/i })).toHaveAttribute(
      'href',
      expect.stringContaining('0x8777d8DF77eD81c2bf17feAAe7F086eEF9f2517A')
    )
  })
})
