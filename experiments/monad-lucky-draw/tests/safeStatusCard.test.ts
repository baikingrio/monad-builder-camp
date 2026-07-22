import { cleanup, fireEvent, render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import SafeStatusCard from '../app/components/SafeStatusCard.vue'
import { createDemoState, transitionDemoState } from '../app/lib/demoState'

const SAFE = '0x59cB895943D081a4b102aA22d19Eda1FabFD37d7'

afterEach(cleanup)

function authenticatedDerivedState() {
  let state = transitionDemoState(createDemoState(), { type: 'walletConnected', eoa: '0x1111111111111111111111111111111111111111' })
  state = transitionDemoState(state, { type: 'monadTestnetChanged', ready: true })
  state = transitionDemoState(state, { type: 'authenticated' })
  return transitionDemoState(state, { type: 'safeDerivationVerified', address: SAFE })
}

describe('SafeStatusCard deployment read UI', () => {
  it('does not request a deployment check before the explicit click', async () => {
    const { emitted } = render(SafeStatusCard, { props: { state: authenticatedDerivedState() } })

    expect(screen.getByText('未知（尚未检查）')).toBeTruthy()
    expect(emitted('check-deployment-status')).toBeUndefined()

    await fireEvent.click(screen.getByRole('button', { name: '检查 Safe 链上状态' }))
    expect(emitted('check-deployment-status')).toHaveLength(1)
  })

  it('keeps the check disabled until an authenticated Safe address has been derived', () => {
    render(SafeStatusCard, { props: { state: createDemoState() } })
    expect((screen.getByRole('button', { name: '检查 Safe 链上状态' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('未知（尚未检查）')).toBeTruthy()
  })

  it('shows the read-only result and an explorer address link only after derivation', () => {
    const state = transitionDemoState(authenticatedDerivedState(), { type: 'safeDeploymentStatusChecked', status: 'not-deployed' })
    const { container } = render(SafeStatusCard, { props: { state } })

    expect(screen.getByText('未部署（链上只读检查）')).toBeTruthy()
    expect(screen.getByText(/eth_getCode 返回 0x/)).toBeTruthy()
    expect(container.querySelector(`a[href$="${SAFE}"]`)).toBeTruthy()
    expect(screen.queryByText(/交易已确认|UserOperation 成功/)).toBeNull()
  })
})
