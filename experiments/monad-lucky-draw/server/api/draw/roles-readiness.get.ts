import { createMonadCodeReader, getRolesReadinessReport, offlineRolesReadinessReport } from '../../utils/rolesStackProbe'

/** Public, read-only Zodiac Roles stack readiness. Never returns RPC URLs or credentials. */
export default defineEventHandler(async () => {
  try {
    const config = useRuntimeConfig()
    const rpcUrl = String(config.public.monadRpcUrl || 'https://testnet-rpc.monad.xyz')
    const report = await getRolesReadinessReport({ readCode: createMonadCodeReader(rpcUrl) })
    return {
      ok: true,
      mode: report.mode,
      enabled: report.enabled,
      blockers: report.blockers,
      legacySafe: report.legacySafe,
      safe7579Superseded: report.safe7579Superseded,
      stack: report.stack
    }
  } catch {
    const fallback = offlineRolesReadinessReport()
    return {
      ok: true,
      mode: fallback.mode,
      enabled: fallback.enabled,
      blockers: fallback.blockers,
      legacySafe: fallback.legacySafe,
      safe7579Superseded: fallback.safe7579Superseded,
      stack: fallback.stack,
      degraded: true
    }
  }
})
