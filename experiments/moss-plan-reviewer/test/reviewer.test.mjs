import test from 'node:test'
import assert from 'node:assert/strict'

import { reviewPlan } from '../src/reviewer.mjs'
import warningPlan from '../fixtures/warning-plan.json' with { type: 'json' }
import excessiveSpendPlan from '../fixtures/excessive-spend-plan.json' with { type: 'json' }
import cleanPlan from '../fixtures/clean-plan.json' with { type: 'json' }

test('stops a plan when simulation reports warnings', () => {
  const result = reviewPlan(warningPlan)

  assert.equal(result.decision, 'STOP')
  assert.deepEqual(result.findings, [
    { code: 'SIMULATION_WARNING', message: 'approval exceeds declared intent' }
  ])
})

test('requires review when a simulated spend is not declared by the intent', () => {
  const plan = structuredClone(cleanPlan)
  plan.simulation.effects.spends = [{ asset: 'USDC', amount: '1' }]

  const result = reviewPlan(plan)

  assert.equal(result.decision, 'REVIEW_REQUIRED')
  assert.deepEqual(result.findings, [
    { code: 'UNDECLARED_SPEND', message: 'USDC simulated spend is not declared by the intent' },
    { code: 'USER_CONFIRMATION_REQUIRED', message: 'no transaction is signed or sent by this reviewer' }
  ])
})

test('requires review when a simulated spend exceeds the user maximum', () => {
  const result = reviewPlan(excessiveSpendPlan)

  assert.equal(result.decision, 'REVIEW_REQUIRED')
  assert.deepEqual(result.findings, [
    { code: 'SPEND_EXCEEDS_MAX', message: 'WMON simulated spend 120 exceeds intent maximum 100' },
    { code: 'USER_CONFIRMATION_REQUIRED', message: 'no transaction is signed or sent by this reviewer' }
  ])
})

test('requires review when an approval spender is outside the declared allowlist', () => {
  const plan = structuredClone(cleanPlan)
  plan.simulation.effects.approvals = [{ spender: '0xunknown', amount: '50' }]

  const result = reviewPlan(plan)

  assert.equal(result.decision, 'REVIEW_REQUIRED')
  assert.deepEqual(result.findings, [
    { code: 'UNEXPECTED_APPROVAL_SPENDER', message: 'approval spender 0xunknown is not in the declared allowlist' },
    { code: 'USER_CONFIRMATION_REQUIRED', message: 'no transaction is signed or sent by this reviewer' }
  ])
})

test('requires review when a receive recipient is outside the declared allowlist', () => {
  const plan = structuredClone(cleanPlan)
  plan.simulation.effects.receives = [{ asset: 'USDC', amount: '200', recipient: '0xunknown' }]

  const result = reviewPlan(plan)

  assert.equal(result.decision, 'REVIEW_REQUIRED')
  assert.deepEqual(result.findings, [
    { code: 'UNEXPECTED_RECIPIENT', message: 'receive recipient 0xunknown is not in the declared allowlist' },
    { code: 'USER_CONFIRMATION_REQUIRED', message: 'no transaction is signed or sent by this reviewer' }
  ])
})

test('still requires user confirmation when effects match the declared intent', () => {
  const result = reviewPlan(cleanPlan)

  assert.equal(result.decision, 'REVIEW_REQUIRED')
  assert.deepEqual(result.findings, [
    { code: 'USER_CONFIRMATION_REQUIRED', message: 'no transaction is signed or sent by this reviewer' }
  ])
})
