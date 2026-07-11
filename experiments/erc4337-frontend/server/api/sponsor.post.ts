import { authorizeSponsorRequest } from '../utils/sponsor-service'

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig()
  const result = await authorizeSponsorRequest(
    await readBody(event),
    Math.floor(Date.now() / 1_000),
    {
      signingEnabled: runtimeConfig.sponsorSigningEnabled === true || runtimeConfig.sponsorSigningEnabled === 'true',
      privateKey: runtimeConfig.sponsorPrivateKey,
      paymaster: runtimeConfig.public.SPONSOR_PAYMASTER_ADDRESS,
      allowedCheckInTarget: runtimeConfig.public.SPONSOR_CHECKIN_TARGET_ADDRESS
    }
  )

  if (!result.ok) {
    setResponseStatus(event, ['SPONSOR_KEY_UNAVAILABLE', 'SPONSOR_SIGNING_UNAVAILABLE'].includes(result.error.code) ? 503 : 400)
  }
  return result
})
