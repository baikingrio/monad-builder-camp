import { resolveSponsorGates } from '../../utils/sponsorGates'

export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  const { readiness } = resolveSponsorGates(config)
  return readiness
})
