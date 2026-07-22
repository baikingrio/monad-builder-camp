import type { ConfirmedCounterfactualSafeState, SimulationPreparationOverrides } from '../../../app/lib/userOperationSimulation'
import { persistentStore } from '../../utils/sqliteStore'
import { evaluateFixedSimulationReadiness } from '../../utils/simulationReadiness'

/**
 * Readiness-only boundary. This endpoint deliberately never invokes a Bundler,
 * Pimlico, Paymaster, Sponsor, signer, Safe deployment, or UserOperation RPC.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ safe?: ConfirmedCounterfactualSafeState; userClicked?: boolean; overrides?: SimulationPreparationOverrides }>(event)
  const sessionId = getCookie(event, 'lucky_draw_session')
  return evaluateFixedSimulationReadiness(persistentStore, {
    sessionId,
    safe: body?.safe,
    userClicked: body?.userClicked === true,
    overrides: body?.overrides
  }, Date.now())
})
