import { createConfig, http, injected } from '@wagmi/core'
import { monadTestnet } from './erc4337Experiments'

export const config = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http(monadTestnet.rpcUrls.default.http[0])
  }
})
