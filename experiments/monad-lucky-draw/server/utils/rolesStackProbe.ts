import { createPublicClient, defineChain, http, type Address, type Hex } from 'viem'
import {
  ROLES_CANONICAL_UPSTREAM,
  defaultRolesStackStatus,
  evaluateRolesReadiness,
  type RolesReadiness,
  type RolesStackStatus
} from '../../app/lib/rolesReadiness'
import { MONAD_ACTIVATION_CONFIG } from '../../app/lib/monadConfig'

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
 * Read-only probe of Monad Testnet for Zodiac Roles stack presence.
 * Manifest / feature / proof gates stay fail-closed until flipped by explicit project config.
 */
export async function probeRolesStackStatus(input: {
  readonly readCode: CodeReader
  readonly deploymentPermitted?: boolean
  readonly rolesSessionEnabled?: boolean
  readonly onchainRolesProofPresent?: boolean
}): Promise<RolesStackStatus> {
  const [masterCopy, factory] = await Promise.all([
    input.readCode(ROLES_CANONICAL_UPSTREAM.rolesMasterCopy as Address),
    input.readCode(ROLES_CANONICAL_UPSTREAM.moduleProxyFactory as Address)
  ])

  return Object.freeze({
    rolesMasterCopyPresent: hasCode(masterCopy),
    moduleProxyFactoryPresent: hasCode(factory),
    deploymentPermitted: input.deploymentPermitted === true,
    rolesSessionEnabled: input.rolesSessionEnabled === true,
    onchainRolesProofPresent: input.onchainRolesProofPresent === true
  })
}

export async function getRolesReadinessReport(input: {
  readonly readCode: CodeReader
}): Promise<RolesReadiness & { readonly stack: RolesStackStatus }> {
  // Stack + session proof completed 2026-07-24; product path is zodiac-roles-session.
  const stack = await probeRolesStackStatus({
    readCode: input.readCode,
    deploymentPermitted: true,
    rolesSessionEnabled: MONAD_ACTIVATION_CONFIG.rolesSessionEnabled === true,
    onchainRolesProofPresent: true
  })
  return Object.freeze({
    ...evaluateRolesReadiness(stack),
    stack
  })
}

export function offlineRolesReadinessReport() {
  const stack = defaultRolesStackStatus()
  return Object.freeze({ ...evaluateRolesReadiness(stack), stack })
}
