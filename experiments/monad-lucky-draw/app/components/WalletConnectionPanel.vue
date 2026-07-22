<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { DemoState } from '../lib/demoState'
import { createEoaLoginController, type Eip1193LoginProvider, type LoginSnapshot } from '../lib/eoaLogin'

const props = defineProps<{ state: DemoState }>()
const emit = defineEmits<{ loginState: [LoginSnapshot] }>()
const login = ref<LoginSnapshot>({ authenticated: false, pending: false })
let controller: ReturnType<typeof createEoaLoginController> | undefined

onMounted(() => {
  const provider = (window as Window & { ethereum?: Eip1193LoginProvider }).ethereum
  controller = createEoaLoginController({
    provider,
    fetch: window.fetch.bind(window),
    origin: window.location.origin,
    onChange(snapshot) { login.value = snapshot; emit('loginState', snapshot) }
  })
})
onBeforeUnmount(() => controller?.dispose())
async function loginWithWallet() { await controller?.connectAndLogin() }
</script>

<template>
  <section class="panel" aria-labelledby="wallet-title">
    <div class="eyebrow">步骤 1</div>
    <h2 id="wallet-title">EOA 身份绑定</h2>
    <p class="description">连接 Monad Testnet EOA 后，点击按钮才会请求一次仅用于登录的 EIP-191 签名。</p>
    <dl class="status-list">
      <div><dt>钱包连接</dt><dd>{{ props.state.walletConnected ? '已连接' : '尚未连接' }}</dd></div>
      <div><dt>登录验证</dt><dd>{{ props.state.authenticated ? '已由服务器验证' : '未验证' }}</dd></div>
      <div><dt>网络</dt><dd>{{ props.state.onMonadTestnet ? 'Monad Testnet 已验证' : '尚未切换到 Monad Testnet' }}</dd></div>
    </dl>
    <p class="notice" role="note">此签名只用于 EOA 登录与账户绑定，不授权 Safe、UserOperation、交易、合约调用或转账。登录前请在钱包中选择 Monad Testnet（Chain ID 10143）。</p>
    <button type="button" :disabled="login.pending" @click="loginWithWallet">
      {{ login.pending ? '正在连接并验证…' : '连接钱包并登录' }}
    </button>
    <p v-if="login.error" class="error" role="alert">{{ login.error }}</p>
    <p class="help">AA 激活、Sponsor 和赞助抽奖仍不可用；本页面不会构建或提交 UserOperation，也不会广播交易。</p>
  </section>
</template>

<style scoped>
.panel { padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 1rem; background: #fff; box-shadow: 0 8px 24px rgb(15 23 42 / 0.05); }.eyebrow { color: #6d28d9; font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }h2 { margin: .35rem 0 .5rem; font-size: 1.2rem; color: #111827; }.description, .help { color: #4b5563; line-height: 1.6; }.status-list { display: grid; gap: .65rem; margin: 1.25rem 0; }.status-list div { display: flex; justify-content: space-between; gap: 1rem; padding-bottom: .55rem; border-bottom: 1px solid #f3f4f6; }dt { color: #6b7280; } dd { margin: 0; color: #1f2937; font-weight: 600; text-align: right; }.notice { padding: .75rem; border-radius: .65rem; background: #f5f3ff; color: #5b21b6; line-height: 1.55; }button { width: 100%; margin-top: .3rem; padding: .75rem 1rem; border: 0; border-radius: .65rem; background: #6d28d9; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }button:disabled { cursor: wait; background: #a78bfa; }.help { margin: .6rem 0 0; font-size: .88rem; }.error { color: #b91c1c; font-weight: 600; }
</style>
