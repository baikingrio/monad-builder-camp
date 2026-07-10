export default defineNuxtConfig({
  compatibilityDate: '2026-07-10',
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    relayUrl: '',
    relayApiKey: '',
    public: {
      // Public Monad Testnet deployment metadata. These are addresses, not secrets.
      ERC1363_TOKEN_ADDRESS: '0x37AFF878FB6b6f4bdDcC6629a5Be46060f526531',
      ERC1363_VAULT_ADDRESS: '0xeF0dDBa411E5586C0B441A068EAAe77a4552B7a7'
    }
  },
  typescript: {
    strict: true
  }
})
