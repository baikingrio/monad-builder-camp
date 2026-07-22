<script setup lang="ts">
import { computed } from 'vue'
import type { DemoState } from '../lib/demoState'
import type { ActivationReadiness } from '../lib/activationReadiness'

export type DrawOutcome =
  | { kind: 'idle' }
  | { kind: 'pending'; message: string }
  | { kind: 'preview'; claimId: string; safe: string; entryPoint: string }
  | { kind: 'success'; userOpHash: string; txHash?: string; safe: string; txUrl?: string }
  | { kind: 'session-ready'; sessionAddress: string; remainingCalls: number; expiresAt: number }
  | { kind: 'session-draw-success'; userOpHash: string; txHash?: string; txUrl?: string; remainingCalls: number }
  | { kind: 'error'; message: string }

const props = withDefaults(defineProps<{
  state: DemoState
  firstDrawAvailable: boolean
  activationReadiness?: ActivationReadiness
  sponsorEnabled?: boolean
  outcome?: DrawOutcome
  sessionEnabled?: boolean
}>(), {
  sponsorEnabled: false,
  sessionEnabled: false,
  outcome: () => ({ kind: 'idle' })
})

const emit = defineEmits<{ activate: []; 'enable-session': []; 'session-draw': [] }>()

const canActivate = computed(() =>
  props.sponsorEnabled
  && props.state.authenticated
  && props.state.safeDerivationVerified
  && props.state.safeDeploymentStatus === 'not-deployed'
  && props.state.onMonadTestnet
  && props.outcome.kind !== 'pending'
  && props.outcome.kind !== 'success'
  && props.outcome.kind !== 'session-ready'
  && props.outcome.kind !== 'session-draw-success'
)

const activationDone = computed(() =>
  props.outcome.kind === 'success'
  || props.outcome.kind === 'session-ready'
  || props.outcome.kind === 'session-draw-success'
  || props.state.safeDeployed
  || props.state.safeDeploymentStatus === 'deployed'
)

const canEnableSession = computed(() =>
  props.sponsorEnabled
  && activationDone.value
  && !props.sessionEnabled
  && props.outcome.kind !== 'pending'
)

const canSessionDraw = computed(() =>
  props.sessionEnabled
  && props.outcome.kind !== 'pending'
)
</script>

<template>
  <section class="panel" aria-labelledby="draw-title">
    <div class="eyebrow">步骤 3</div>
    <h2 id="draw-title">激活与抽奖</h2>
    <p class="description">
      在 Sponsor 就绪时，点击后将：服务端用 Pimlico 赞助固定 <code>draw()</code> UserOperation → 钱包签署一次 Owner 授权 → 广播并等待 receipt。
      登录签名不等于链上 AA 授权。
    </p>
    <button
      type="button"
      class="activate"
      :disabled="!canActivate"
      aria-describedby="activation-help"
      @click="emit('activate')"
    >激活并免费抽一次</button>
    <p id="activation-help" class="help">
      需要：已登录、Monad Testnet、Safe 已推导且链上确认为未部署、服务端 Sponsor 已启用。不会在未点击时请求签名或广播。
    </p>

    <div class="divider" aria-hidden="true"></div>
    <h3>后续抽奖</h3>
    <p class="description">
      启用免弹窗会生成浏览器 Session Key，并需<strong>一次</strong> Owner 钱包授权将其加入 Safe。
      之后抽奖由 Session Key 本地签名，不再弹窗。服务端仍只允许固定 <code>draw()</code>，且有次数与过期限制。
    </p>
    <button
      type="button"
      class="activate"
      :disabled="!canEnableSession"
      @click="emit('enable-session')"
    >启用免弹窗抽奖</button>
    <button
      type="button"
      class="activate"
      :disabled="!canSessionDraw"
      aria-describedby="session-help"
      @click="emit('session-draw')"
    >免弹窗抽奖</button>
    <p id="session-help" class="help">
      Session Key 在链上是 Safe owner（threshold=1），密码学上权限较宽；Demo 依赖短有效期、少次数与服务端拒签非 draw 调用。
    </p>

    <p v-if="props.outcome.kind === 'idle'" class="result" role="status">暂无抽奖结果。</p>
    <p v-else-if="props.outcome.kind === 'pending'" class="result pending" role="status">{{ props.outcome.message }}</p>
    <p v-else-if="props.outcome.kind === 'preview'" class="result pending" role="status">
      已获得赞助准备（claim {{ props.outcome.claimId }}）。等待钱包签署 Owner UserOperation…
    </p>
    <div v-else-if="props.outcome.kind === 'success'" class="result success" role="status">
      <p>首次激活抽卡已上链确认。</p>
      <p>Safe：<code>{{ props.outcome.safe }}</code></p>
      <p>UserOperation：<code>{{ props.outcome.userOpHash }}</code></p>
      <p v-if="props.outcome.txHash">交易：<code>{{ props.outcome.txHash }}</code></p>
      <a v-if="props.outcome.txUrl" :href="props.outcome.txUrl" target="_blank" rel="noopener noreferrer">在 MonadVision 查看交易</a>
    </div>
    <div v-else-if="props.outcome.kind === 'session-ready'" class="result success" role="status">
      <p>免弹窗已启用。剩余次数：{{ props.outcome.remainingCalls }}。</p>
      <p>Session：<code>{{ props.outcome.sessionAddress }}</code></p>
    </div>
    <div v-else-if="props.outcome.kind === 'session-draw-success'" class="result success" role="status">
      <p>免弹窗抽卡已确认。剩余次数：{{ props.outcome.remainingCalls }}。</p>
      <p>UserOperation：<code>{{ props.outcome.userOpHash }}</code></p>
      <a v-if="props.outcome.txUrl" :href="props.outcome.txUrl" target="_blank" rel="noopener noreferrer">在 MonadVision 查看交易</a>
    </div>
    <p v-else class="result error" role="status">失败：{{ props.outcome.message }}</p>
  </section>
</template>

<style scoped>
.panel { padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 1rem; background: #fff; box-shadow: 0 8px 24px rgb(15 23 42 / 0.05); }.eyebrow{color:#6d28d9;font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}h2{margin:.35rem 0 .5rem;font-size:1.2rem;color:#111827}h3{margin:0 0 .4rem;color:#1f2937;font-size:1rem}.description,.help{color:#4b5563;line-height:1.6}button{width:100%;margin-top:.55rem;padding:.75rem 1rem;border:0;border-radius:.65rem;font:inherit;font-weight:700}button:disabled{cursor:not-allowed;background:#e5e7eb;color:#6b7280}.activate:not(:disabled){cursor:pointer;background:#6d28d9;color:#fff}.help{margin:.6rem 0 0;font-size:.88rem}.divider{height:1px;margin:1.35rem 0;background:#e5e7eb}.result{margin:1.1rem 0 0;padding:.75rem;border-radius:.65rem;background:#f9fafb;color:#374151;font-size:.9rem;line-height:1.55}.result.pending{background:#eff6ff;color:#1e3a8a}.result.success{background:#ecfdf5;color:#065f46}.result.success a{color:#047857;font-weight:700}.result.error{background:#fef2f2;color:#991b1b}code{overflow-wrap:anywhere}
</style>
