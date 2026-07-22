import { verifyEoaLogin } from '../../utils/auth'
import { persistentStore } from '../../utils/sqliteStore'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ eoa?: string; origin?: string; nonce?: string; message?: string; signature?: string }>(event)
  const now = Date.now()
  return verifyEoaLogin(persistentStore, {
    eoa: typeof body?.eoa === 'string' ? body.eoa : '',
    origin: typeof body?.origin === 'string' ? body.origin : '',
    nonce: typeof body?.nonce === 'string' ? body.nonce : '',
    message: typeof body?.message === 'string' ? body.message : '',
    signature: typeof body?.signature === 'string' ? body.signature : '',
    now
  })
})
