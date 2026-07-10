import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Erc1363Page from '../app/pages/erc1363.vue'

vi.mock('@wagmi/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@wagmi/core')>()
  return {
    ...actual,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getAccount: vi.fn(() => ({})),
    switchChain: vi.fn(),
    writeContract: vi.fn()
  }
})

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return { ...actual, createPublicClient: vi.fn() }
})

beforeEach(() => {
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { ERC1363_TOKEN_ADDRESS: '', ERC1363_VAULT_ADDRESS: '' }
  }))
})

describe('ERC-1363 staking page', () => {
  it('shows a clear disabled state and never exposes write actions without deployed addresses', () => {
    render(Erc1363Page)

    expect(screen.getByRole('heading', { name: /ERC-1363 质押分红/ })).toBeInTheDocument()
    expect(screen.getByText('未配置合约地址')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '质押' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '领取分红' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '提取质押' })).toBeDisabled()
  })
})
