export default defineNuxtConfig({
  compatibilityDate: '2026-07-22',
  // Prevent accidental visits to /10143 (chain id) from becoming a blank-looking 404.
  routeRules: {
    '/10143': { redirect: '/' }
  },
  runtimeConfig: {
    // Explicit env mapping: .env uses LUCKY_DRAW_* (not only NUXT_*).
    luckyDrawSessionSecret: process.env.LUCKY_DRAW_SESSION_SECRET || '',
    luckyDrawSponsorSigningEnabled: process.env.LUCKY_DRAW_SPONSOR_SIGNING_ENABLED === 'true',
    luckyDrawSponsorPrivateKey: process.env.LUCKY_DRAW_SPONSOR_PRIVATE_KEY || '',
    luckyDrawPimlicoApiKey: process.env.LUCKY_DRAW_PIMLICO_API_KEY || '',
    luckyDrawSponsorMaxGas: process.env.LUCKY_DRAW_SPONSOR_MAX_GAS || '',
    luckyDrawSponsorTotalBudget: process.env.LUCKY_DRAW_SPONSOR_TOTAL_BUDGET || '',
    luckyDrawSafe4337Module: process.env.LUCKY_DRAW_SAFE_4337_MODULE || '',
    luckyDrawFaucetEnabled: process.env.LUCKY_DRAW_FAUCET_ENABLED === 'true',
    luckyDrawFaucetPrivateKey: process.env.LUCKY_DRAW_FAUCET_PRIVATE_KEY || '',
    public: {
      monadChainId: Number(process.env.NUXT_PUBLIC_MONAD_CHAIN_ID || 10143),
      monadRpcUrl: process.env.NUXT_PUBLIC_MONAD_RPC_URL || '',
      monadExplorerUrl: process.env.NUXT_PUBLIC_MONAD_EXPLORER_URL || 'https://testnet.monadvision.com',
      luckyDrawContractAddress: process.env.NUXT_PUBLIC_LUCKY_DRAW_CONTRACT_ADDRESS || '',
      safeFactoryAddress: process.env.NUXT_PUBLIC_SAFE_FACTORY_ADDRESS || '',
      entryPointAddress: process.env.NUXT_PUBLIC_ENTRY_POINT_ADDRESS || ''
    }
  },
  typescript: {
    strict: true
  }
})
