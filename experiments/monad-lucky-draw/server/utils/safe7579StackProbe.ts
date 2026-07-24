import { createPublicClient, defineChain, http, type Address, type Hex } from 'viem'
import {
  SAFE7579_KNOWN_ABSENT,
  defaultSafe7579StackStatus,
  evaluateSafe7579Readiness,
  type Safe7579Readiness,
  type Safe7579StackStatus
} from '../../app/lib/safe7579Readiness'

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
})

export type CodeReader = (address: Address) => Promise<Hex>

export function createMonadCodeReader(rpcUrl = monadTestnet.rpcUrls.default.http[0]): CodeReader {
  const client = createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) })
  return async (address) => client.getBytecode({ address }) ?? '0x'
}

function hasCode(bytecode: Hex | undefined): boolean {
  return typeof bytecode === 'string' && bytecode !== '0x' && bytecode.length > 2
}

/**
 * Read-only probe of Monad Testnet for Safe7579 stack presence.
 * Audit / manifest / receipt gates stay fail-closed until flipped by explicit project config.
 */
export async function probeSafe7579StackStatus(input: {
  readonly readCode: CodeReader
  readonly deploymentPermitted?: boolean
  readonly customPoliciesAudited?: boolean
  readonly onchainPolicyReceiptPresent?: boolean
}): Promise<Safe7579StackStatus> {
  const [launchpad, adapter, smartSession] = await Promise.all([
    input.readCode(SAFE7579_KNOWN_ABSENT.launchpad as Address),
    input.readCode(SAFE7579_KNOWN_ABSENT.adapter as Address),
    input.readCode(SAFE7579_KNOWN_ABSENT.smartSessionEmissary as Address)
  ])

  return Object.freeze({
    launchpadCodePresent: hasCode(launchpad),
    adapterCodePresent: hasCode(adapter),
    smartSessionCodePresent: hasCode(smartSession),
    customPoliciesAudited: input.customPoliciesAudited === true,
    deploymentPermitted: input.deploymentPermitted === true,
    onchainPolicyReceiptPresent: input.onchainPolicyReceiptPresent === true
  })
}

export async function getSafe7579ReadinessReport(input: {
  readonly readCode: CodeReader
}): Promise<Safe7579Readiness & { readonly stack: Safe7579StackStatus }> {
  // Manifest gates remain closed: custom policies are localOnly / NOT_AUDITED; no on-chain receipt yet.
  const stack = await probeSafe7579StackStatus({
    readCode: input.readCode,
    customPoliciesAudited: false,
    deploymentPermitted: false,
    onchainPolicyReceiptPresent: false
  })
  return Object.freeze({
    ...evaluateSafe7579Readiness(stack),
    stack
  })
}

export function offlineSafe7579ReadinessReport() {
  const stack = defaultSafe7579StackStatus()
  return Object.freeze({ ...evaluateSafe7579Readiness(stack), stack })
}
