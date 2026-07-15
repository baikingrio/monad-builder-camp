export function reviewPlan({ intent, simulation }) {
  if (simulation.warnings.length > 0) {
    return {
      decision: 'STOP',
      findings: simulation.warnings.map((message) => ({
        code: 'SIMULATION_WARNING',
        message
      }))
    }
  }

  const maximumByAsset = new Map(
    intent.maxSpends.map(({ asset, amount }) => [asset, BigInt(amount)])
  )
  const findings = []

  for (const spend of simulation.effects.spends) {
    const maximum = maximumByAsset.get(spend.asset)
    if (maximum === undefined) {
      findings.push({
        code: 'UNDECLARED_SPEND',
        message: `${spend.asset} simulated spend is not declared by the intent`
      })
    } else if (BigInt(spend.amount) > maximum) {
      findings.push({
        code: 'SPEND_EXCEEDS_MAX',
        message: `${spend.asset} simulated spend ${spend.amount} exceeds intent maximum ${maximum}`
      })
    }
  }

  for (const approval of simulation.effects.approvals) {
    if (!intent.allowedApprovalSpenders.includes(approval.spender)) {
      findings.push({
        code: 'UNEXPECTED_APPROVAL_SPENDER',
        message: `approval spender ${approval.spender} is not in the declared allowlist`
      })
    }
  }

  for (const receive of simulation.effects.receives) {
    if (!intent.allowedRecipients.includes(receive.recipient)) {
      findings.push({
        code: 'UNEXPECTED_RECIPIENT',
        message: `receive recipient ${receive.recipient} is not in the declared allowlist`
      })
    }
  }

  findings.push({
    code: 'USER_CONFIRMATION_REQUIRED',
    message: 'no transaction is signed or sent by this reviewer'
  })

  return { decision: 'REVIEW_REQUIRED', findings }
}
