import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-10',
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [nodePolyfills()]
  },
  runtimeConfig: {
    sponsorPrivateKey: '',
    sponsorSigningEnabled: false,
    public: {
      ERC1363_TOKEN_ADDRESS: '0x37AFF878FB6b6f4bdDcC6629a5Be46060f526531',
      ERC1363_VAULT_ADDRESS: '0xeF0dDBa411E5586C0B441A068EAAe77a4552B7a7',
      SPONSOR_PAYMASTER_ADDRESS: '',
      SPONSOR_CHECKIN_TARGET_ADDRESS: '',
      NUXT_PUBLIC_PIMLICO_API_KEY: '',
      NUXT_PUBLIC_MONAD_PIMLICO_API_KEY: ''
    }
  },
  typescript: {
    strict: true
  }
})
