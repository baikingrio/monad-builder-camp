import { createMonadCodeReader, getSafe7579ReadinessReport, offlineSafe7579ReadinessReport } from '../../utils/safe7579StackProbe'

/** Public, read-only Safe7579 stack readiness. Never returns RPC URLs or credentials. */
export default defineEventHandler(async () => {
  try {
    const config = useRuntimeConfig()
    const rpcUrl = String(config.public.monadRpcUrl || 'https://testnet-rpc.monad.xyz')
    const report = await getSafe7579ReadinessReport({ readCode: createMonadCodeReader(rpcUrl) })
    return {
      ok: true,
      mode: report.mode,
      enabled: report.enabled,
      blockers: report.blockers,
      legacySafe: report.legacySafe,
      stack: report.stack
    }
  } catch {
    const fallback = offlineSafe7579ReadinessReport()
    return {
      ok: true,
      mode: fallback.mode,
      enabled: fallback.enabled,
      blockers: fallback.blockers,
      legacySafe: fallback.legacySafe,
      stack: fallback.stack,
      degraded: true
    }
  }
})
