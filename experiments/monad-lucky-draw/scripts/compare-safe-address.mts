import { createPublicClient, http, defineChain } from 'viem'
import { toAccount } from 'viem/accounts'
import { toSafeSmartAccount } from 'permissionless/accounts'
import { MONAD_ACTIVATION_CONFIG } from '../app/lib/monadConfig'
import { deriveMonadCounterfactualSafe } from '../app/lib/safeAddress'

const OWNER = '0x7c0343c808B827e4286381c2292d92c3f19152a4' as const

async function main() {
  const derived = deriveMonadCounterfactualSafe({ owner: OWNER, config: MONAD_ACTIVATION_CONFIG })
  console.log('local derived', derived.address)

  const monad = defineChain({
    id: 10143,
    name: 'Monad Testnet',
    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
    rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
  })
  const client = createPublicClient({ chain: monad, transport: http('https://testnet-rpc.monad.xyz') })
  const account = await toSafeSmartAccount({
    client,
    owners: [toAccount({
      address: OWNER,
      async signMessage() { throw new Error('no') },
      async signTransaction() { throw new Error('no') },
      async signTypedData() { throw new Error('no') }
    })],
    version: '1.4.1',
    entryPoint: { address: MONAD_ACTIVATION_CONFIG.entryPoint as `0x${string}`, version: '0.7' },
    safe4337ModuleAddress: MONAD_ACTIVATION_CONFIG.safe4337Module as `0x${string}`,
    safeModuleSetupAddress: MONAD_ACTIVATION_CONFIG.safeModuleSetup as `0x${string}`,
    safeProxyFactoryAddress: MONAD_ACTIVATION_CONFIG.safeFactory as `0x${string}`,
    safeSingletonAddress: MONAD_ACTIVATION_CONFIG.safeSingleton as `0x${string}`,
    saltNonce: 0n,
    useMultiSendForSetup: false
  })
  console.log('permissionless', account.address)
  console.log('match', account.address.toLowerCase() === derived.address.toLowerCase())
}

main().catch((e) => {
  console.error('ERROR', e)
  process.exit(1)
})
