export default defineNuxtConfig({
  compatibilityDate: '2026-07-22',
  runtimeConfig: {
    luckyDrawSessionSecret: '',
    luckyDrawSponsorSigningEnabled: false,
    luckyDrawSponsorPrivateKey: '',
    luckyDrawPimlicoApiKey: '',
    luckyDrawSponsorMaxGas: '',
    luckyDrawSponsorTotalBudget: '',
    luckyDrawFaucetEnabled: false,
    luckyDrawFaucetPrivateKey: '',
    public: {
      monadChainId: 10143,
      monadRpcUrl: '',
      monadExplorerUrl: 'https://testnet.monadvision.com',
      luckyDrawContractAddress: '',
      safeFactoryAddress: '',
      entryPointAddress: ''
    }
  },
  typescript: {
    strict: true
  }
})
