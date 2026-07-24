import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import DrawResultCard from '../app/components/DrawResultCard.vue'
import { createDemoState } from '../app/lib/demoState'

afterEach(cleanup)

describe('EntryPoint deposit UI', () => {
  it('distinguishes sponsored activation from user-funded Session enable/draw and treats a positive deposit only as detected', () => {
    render(DrawResultCard, {
      props: {
        state: createDemoState(),
        firstDrawAvailable: false,
        entryPointDeposit: '1',
        sessionFundingSufficient: true,
        sessionMode: 'legacy-owner-session',
        sessionBlockers: ['manifest-deployment-not-permitted']
      }
    })
    expect(screen.getByText(/首次激活.*Sponsor 赞助/)).toBeTruthy()
    expect(screen.getByText(/legacy-owner-session/)).toBeTruthy()
    expect(screen.getByText(/阻断项：/)).toBeTruthy()
    expect(screen.getByText(/Deposit 已检测到；最终余额是否足够由服务端准备时确认/)).toBeTruthy()
    expect(screen.queryByText(/余额不足时会禁用抽奖/)).toBeNull()
  })
})
