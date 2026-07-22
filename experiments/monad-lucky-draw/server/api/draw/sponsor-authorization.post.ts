import { resolveSponsorGates } from '../../utils/sponsorGates'

/** Legacy endpoint: readiness only; never returns a Paymaster credential or private key. */
export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  const { readiness } = resolveSponsorGates(config)
  return { ...readiness, authorization: null }
})
