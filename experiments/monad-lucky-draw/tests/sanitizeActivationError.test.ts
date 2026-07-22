import { describe, expect, it } from 'vitest'
import { sanitizeActivationError } from '../server/utils/sanitizeActivationError'

describe('sanitizeActivationError', () => {
  it('redacts Pimlico API keys and keeps AA23 reason', () => {
    const message = sanitizeActivationError(new Error(
      'RPC Request failed.\n\nURL: https://api.pimlico.io/v2/monad-testnet/rpc?add_balance_override&apikey=pim_SECRETKEY123\nDetails: UserOperation reverted during simulation with reason: AA23 reverted 0x\nVersion: viem@2.44.4'
    ))
    expect(message).toContain('AA23')
    expect(message).not.toContain('pim_SECRETKEY123')
    expect(message).not.toContain('apikey=pim_')
  })
})
