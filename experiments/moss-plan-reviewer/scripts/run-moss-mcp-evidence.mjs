#!/usr/bin/env node
/**
 * Drive the official Moss MCP server over stdio without signing or sending.
 *
 * Prerequisites:
 *   git clone https://github.com/nishuzumi/moss "$MOSS_SOURCE_DIR"
 *   cd "$MOSS_SOURCE_DIR" && pnpm install --frozen-lockfile && pnpm build
 *
 * Run from experiments/moss-plan-reviewer:
 *   MOSS_SOURCE_DIR=/absolute/path/to/moss node scripts/run-moss-mcp-evidence.mjs
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const mossRoot = process.env.MOSS_SOURCE_DIR
if (!mossRoot) {
  throw new Error('MOSS_SOURCE_DIR must point to a built checkout of github.com/nishuzumi/moss')
}

const packageAnchor = path.join(mossRoot, 'packages/mcp-server/package.json')
const serverCli = path.join(mossRoot, 'packages/mcp-server/dist/cli.js')
if (!existsSync(packageAnchor) || !existsSync(serverCli)) {
  throw new Error('Moss MCP build is missing; run pnpm install --frozen-lockfile && pnpm build in MOSS_SOURCE_DIR')
}

const requireFromMoss = createRequire(packageAnchor)
const { Client } = requireFromMoss('@modelcontextprotocol/sdk/client/index.js')
const { StdioClientTransport } = requireFromMoss('@modelcontextprotocol/sdk/client/stdio.js')

const rpcUrl = process.env.MOSS_EVIDENCE_RPC_URL ?? 'https://rpc.monad.xyz'
const chainId = process.env.MOSS_EVIDENCE_CHAIN_ID ?? '143'
const account = process.env.MOSS_EVIDENCE_ACCOUNT ?? '0xCcCccCCCcCCcccCcCccccCcCCCCcccccCcCCcCcC'

const transport = new StdioClientTransport({
  command: 'node',
  args: [serverCli],
  env: {
    ...process.env,
    MOSS_RPC_URL: rpcUrl,
    MOSS_CHAIN_ID: chainId,
  },
})
const client = new Client({ name: 'moss-plan-reviewer-evidence', version: '0.1.0' })

await client.connect(transport)
try {
  const tools = await client.listTools()
  const discover = await client.callTool({ name: 'discover', arguments: { verb: 'wrap' } })
  const load = await client.callTool({
    name: 'load',
    arguments: { items: [{ protocol: 'wmon', method: 'wrap' }] },
  })
  const action = await client.callTool({
    name: 'action',
    arguments: {
      protocol: 'wmon',
      method: 'wrap',
      account,
      params: { amount: '0.001' },
    },
  })
  const plan = JSON.parse(action.content[0].text)
  const simulation = await client.callTool({ name: 'simulate', arguments: { plans: [plan] } })
  const outcome = JSON.parse(simulation.content[0].text)
  const result = outcome.results?.[0]

  const evidence = {
    mode: 'read-only MCP + live Monad mainnet RPC simulation',
    rpcUrl,
    toolNames: tools.tools.map((tool) => tool.name).sort(),
    discovered: JSON.parse(discover.content[0].text),
    loaded: JSON.parse(load.content[0].text).map((item) => ({
      protocol: item.protocol,
      method: item.method,
      declaredRisk: item.declaredRisk,
    })),
    plan: {
      chainId: plan.chainId,
      protocol: plan.protocol,
      method: plan.method,
      txCount: plan.txs.length,
      planHash: plan.planHash,
    },
    simulation: {
      ok: outcome.ok,
      warningCount: result?.warnings?.length ?? null,
      guidance: outcome.guidance,
    },
    safetyBoundary: 'Moss MCP generated and simulated an unsigned Plan only; this script never reads a wallet key, signs, or broadcasts a transaction.',
  }

  if (evidence.simulation.warningCount !== 0 || evidence.simulation.ok !== true) {
    throw new Error(`Moss simulation did not clear the safety gate: ${JSON.stringify(evidence.simulation)}`)
  }
  console.log(JSON.stringify(evidence, null, 2))
} finally {
  await client.close()
}
