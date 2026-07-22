<script setup lang="ts">
import { computed, ref } from 'vue'
import { createDemoState, isDrawAvailable, transitionDemoState } from '../lib/demoState'
import type { LoginSnapshot } from '../lib/eoaLogin'
import { evaluateActivationReadiness } from '../lib/activationReadiness'
import { MONAD_ACTIVATION_CONFIG } from '../lib/monadConfig'
import WalletConnectionPanel from '../components/WalletConnectionPanel.vue'
import SafeStatusCard from '../components/SafeStatusCard.vue'
import DrawResultCard from '../components/DrawResultCard.vue'

const demoState = ref(createDemoState())
const activationReadiness = evaluateActivationReadiness({
  config: MONAD_ACTIVATION_CONFIG,
  sponsorPolicy: { persistent: false, authorized: false },
  userClicked: false
})
const firstDrawAvailable = computed(() => isDrawAvailable(demoState.value) && activationReadiness.canConstructUserOperation)

function syncLogin(snapshot: LoginSnapshot) {
  if (!snapshot.authenticated || !snapshot.account || snapshot.chainId !== 10143) {
    demoState.value = createDemoState()
    return
  }
  let next = transitionDemoState(createDemoState(), { type: 'walletConnected', eoa: snapshot.account })
  next = transitionDemoState(next, { type: 'monadTestnetChanged', ready: true })
  demoState.value = transitionDemoState(next, { type: 'authenticated' })
}
</script>

<template>
  <main class="page-shell">
    <header class="hero" aria-labelledby="page-title">
      <p class="network-badge">Monad Testnet</p>
      <h1 id="page-title">Monad Lucky Draw</h1>
      <p class="lead">一个围绕 EOA 绑定、反事实 Safe 与后续 Session Key 的学习型抽奖流程。</p>
      <div class="security-boundary" role="note" aria-label="安全边界">
        <strong>安全边界：</strong>仅限测试网，不涉及真实资产。仅在点击“连接钱包并登录”后才会请求登录签名；不会发送交易或执行 UserOperation。
      </div>
    </header>

    <section class="journey" aria-labelledby="journey-title">
      <div class="section-heading">
        <p class="eyebrow">预期旅程</p>
        <h2 id="journey-title">先验证身份，再准备执行权限</h2>
      </div>
      <div class="cards">
        <WalletConnectionPanel :state="demoState" @login-state="syncLogin" />
        <SafeStatusCard :state="demoState" />
        <DrawResultCard :state="demoState" :first-draw-available="firstDrawAvailable" :activation-readiness="activationReadiness" />
      </div>
    </section>

    <aside class="faucet-boundary" aria-labelledby="faucet-title">
      <h2 id="faucet-title">测试代币边界</h2>
      <p><strong>测试代币请使用 Monad 官方水龙头。</strong>本应用不提供水龙头、不保管私钥、不发送测试币。</p>
    </aside>
  </main>
</template>

<style scoped>
:global(*) { box-sizing: border-box; }
:global(body) { margin: 0; background: #f8fafc; color: #111827; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.page-shell { width: min(1120px, calc(100% - 2rem)); margin: 0 auto; padding: 3rem 0; }.hero { max-width: 780px; }.network-badge { display: inline-block; margin: 0; padding: .35rem .7rem; border-radius: 999px; background: #ede9fe; color: #5b21b6; font-size: .82rem; font-weight: 800; }.hero h1 { margin: .8rem 0 .45rem; font-size: clamp(2rem, 5vw, 3.4rem); letter-spacing: -.04em; }.lead { margin: 0; color: #4b5563; font-size: 1.1rem; line-height: 1.65; }.security-boundary { margin-top: 1.4rem; padding: 1rem 1.1rem; border: 1px solid #c4b5fd; border-radius: .8rem; background: #faf5ff; color: #4c1d95; line-height: 1.6; }.journey { margin-top: 3rem; }.section-heading { margin-bottom: 1.15rem; }.eyebrow { margin: 0 0 .3rem; color: #6d28d9; font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }.section-heading h2, .faucet-boundary h2 { margin: 0; font-size: 1.35rem; }.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }.faucet-boundary { margin-top: 1.25rem; padding: 1.15rem 1.25rem; border-left: 4px solid #7c3aed; border-radius: .65rem; background: #fff; }.faucet-boundary p { margin: .5rem 0 0; color: #374151; line-height: 1.6; } @media (max-width: 820px) { .page-shell { padding: 2rem 0; }.cards { grid-template-columns: 1fr; } }
</style>
