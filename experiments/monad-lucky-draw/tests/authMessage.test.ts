import { describe, expect, it } from 'vitest'
import {
  buildLoginMessage,
  createLoginMessage,
  type LoginMessageInput
} from '../app/lib/authMessage'
import {
  createSafeDerivationRequest,
  type SafeDerivationInput
} from '../app/lib/safeAddress'

const loginInput: LoginMessageInput = {
  eoa: '0x1111111111111111111111111111111111111111',
  nonce: 'nonce-7f6d6f9e-9f2e-4b42-a889-123456789abc',
  origin: 'https://lucky-draw.example',
  issuedAt: '2026-07-22T10:00:00.000Z',
  expiresAt: '2026-07-22T10:05:00.000Z'
}

describe('EOA login message', () => {
  it('binds login message to EOA, nonce, origin and expiry', () => {
    const message = buildLoginMessage(loginInput)

    expect(message.type).toBe('eoa-login-binding')
    expect(message.eoa).toBe(loginInput.eoa)
    expect(message.nonce).toBe(loginInput.nonce)
    expect(message.origin).toBe(loginInput.origin)
    expect(message.issuedAt).toBe(loginInput.issuedAt)
    expect(message.expiresAt).toBe(loginInput.expiresAt)
    expect(message.text).toContain(`EOA: ${loginInput.eoa}`)
    expect(message.text).toContain(`Nonce: ${loginInput.nonce}`)
    expect(message.text).toContain(`Origin: ${loginInput.origin}`)
    expect(message.text).toContain(`Issued At: ${loginInput.issuedAt}`)
    expect(message.text).toContain(`Expires At: ${loginInput.expiresAt}`)
    expect(createLoginMessage(loginInput)).toEqual(message)
  })

  it('does not treat a login signature as Safe execution authorization', () => {
    const { text, type } = buildLoginMessage(loginInput)

    expect(type).toBe('eoa-login-binding')
    expect(text).toMatch(/authentication and account binding only/i)
    expect(text).toMatch(/does not authorize.*Safe.*UserOperation.*transaction.*contract call.*transfer/i)
  })

  it.each([
    { ...loginInput, eoa: 'not-an-address' },
    { ...loginInput, nonce: '' },
    { ...loginInput, nonce: 'short' },
    { ...loginInput, origin: 'not an origin' },
    { ...loginInput, expiresAt: loginInput.issuedAt },
    { ...loginInput, expiresAt: 'not-a-date' }
  ])('rejects invalid login input', (input) => {
    expect(() => buildLoginMessage(input)).toThrow()
  })
})

describe('Safe derivation request input', () => {
  const derivationInput: SafeDerivationInput = {
    owner: '0x1111111111111111111111111111111111111111',
    factory: '0x2222222222222222222222222222222222222222',
    saltNonce: '0'
  }

  it('forms a typed request but does not claim to derive a Safe address', () => {
    const request = createSafeDerivationRequest(derivationInput)

    expect(request.kind).toBe('safe-derivation-request')
    expect(request.owner).toBe(derivationInput.owner)
    expect(request.factory).toBe(derivationInput.factory)
    expect(request.saltNonce).toBe(0n)
    expect(Object.keys(request).join(' ')).not.toMatch(/address|derived/i)
  })

  it.each([
    { ...derivationInput, owner: '0x1234' },
    { ...derivationInput, factory: 'not-an-address' },
    { ...derivationInput, owner: '0x0000000000000000000000000000000000000000' },
    { ...derivationInput, saltNonce: '-1' },
    { ...derivationInput, saltNonce: '1.5' },
    { ...derivationInput, saltNonce: (2n ** 256n).toString() }
  ])('rejects invalid Safe derivation input', (input) => {
    expect(() => createSafeDerivationRequest(input)).toThrow()
  })
})
