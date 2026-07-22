import { verifyEoaLogin } from '../../utils/auth'
import { persistentStore } from '../../utils/sqliteStore'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ eoa?: string; origin?: string; nonce?: string; message?: string; signature?: string }>(event)
  const now = Date.now()
  const result = await verifyEoaLogin(persistentStore, {
    eoa: typeof body?.eoa === 'string' ? body.eoa : '',
    origin: typeof body?.origin === 'string' ? body.origin : '',
    nonce: typeof body?.nonce === 'string' ? body.nonce : '',
    message: typeof body?.message === 'string' ? body.message : '',
    signature: typeof body?.signature === 'string' ? body.signature : '',
    now
  })
  if (result.authenticated) {
    setCookie(event, 'lucky_draw_session', result.session.id, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: Math.max(1, Math.floor((result.session.expiresAt - now) / 1000))
    })
  }
  // The verified session is held in an HttpOnly cookie, never returned to browser code.
  return result.authenticated
    ? { authenticated: true, eoa: result.eoa, persistence: result.persistence }
    : result
})
