<script setup lang="ts">
import { computed } from 'vue'
import type { DemoState } from '../lib/demoState'
import type { ActivationReadiness } from '../lib/activationReadiness'
import type { RolesSessionMode } from '../lib/rolesReadiness'

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
  entryPointDeposit?: string
  sessionFundingSufficient?: boolean
  sessionMode?: RolesSessionMode
  sessionBlockers?: readonly string[]
}>(), {
  sponsorEnabled: false,
  sessionEnabled: false,
  entryPointDeposit: '0',
  sessionFundingSufficient: false,
  sessionMode: 'legacy-owner-session',
  sessionBlockers: () => [],
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
  && props.sessionFundingSufficient
  && props.outcome.kind !== 'pending'
)

const canSessionDraw = computed(() =>
  props.sessionEnabled
  && props.sessionFundingSufficient
  && props.outcome.kind !== 'pending'
)
</script>

<template>
  <section class="panel" aria-labelledby="draw-title">
    <div class="eyebrow">步骤 3</div>
    <h2 id="draw-title">激活与抽奖</h2>
    <p class="description">
      首次激活由 Sponsor 赞助：服务端用 Pimlico 赞助固定 <code>draw()</code> UserOperation → 钱包签署一次 Owner 授权 → 广播并等待 receipt。
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
    <p class="mode-badge" role="status" :data-mode="props.sessionMode">
      Session 模式：
      <strong v-if="props.sessionMode === 'legacy-owner-session'">legacy-owner-session（服务端策略 + 3 次上限）</strong>
      <strong v-else>zodiac-roles-session（Roles member，自付 gas，无次数上限）</strong>
    </p>
    <p v-if="props.sessionMode === 'legacy-owner-session' && props.sessionBlockers.length" class="help" id="session-mode-blockers">
      Zodiac Roles 尚未启用（Safe7579 产品路径已归档）。阻断项：{{ props.sessionBlockers.join(', ') }}。
    </p>
    <p class="description">
      当前为 <strong v-if="props.sessionMode === 'zodiac-roles-session'">Roles</strong><strong v-else>legacy</strong> 路径。
      <template v-if="props.sessionMode === 'zodiac-roles-session'">
        启用时 Owner 一次授权安装 Roles（Session Key 为 member，非 owner），并向 Session Key tip 约 0.1 MON；抽奖为 Session Key EOA 调用 <code>execTransactionWithRole(draw)</code>。自付 gas，<strong>无次数上限</strong>；仍保留 24h TTL。启用前请确保 Safe 有足够原生 MON（tip）。
      </template>
      <template v-else>
        启用时 Owner 一次授权将 Session Key <code>addOwnerWithThreshold</code>；启用与抽奖 Gas 由 EntryPoint Deposit 支付。服务端仍只允许固定 <code>draw()</code>，并保留 <strong>3 次</strong>与 24h TTL。
      </template>
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
      <template v-if="props.sessionMode === 'zodiac-roles-session'">
        Roles 启用 Gas 由 EntryPoint Deposit 支付；抽奖 Gas 由 Session Key 原生 MON tip 支付。Deposit：{{ props.entryPointDeposit }} wei。Session Key 是 Roles member（非 Safe owner），链上仅允许 <code>LuckyDraw.draw()</code>。自付 gas，无次数上限；仍保留 24h TTL。
      </template>
      <template v-else>
        EntryPoint Deposit：{{ props.entryPointDeposit }} wei MON。Session Key 在链上是 Safe owner（threshold=1），密码学上权限较宽；仅测试网。legacy Demo 依赖短有效期、<strong>3 次</strong>限制与服务端拒签非 draw 调用。
      </template>
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
      <p>免弹窗已启用（legacy）。剩余次数：{{ props.outcome.remainingCalls }}。</p>
      <p>Session：<code>{{ props.outcome.sessionAddress }}</code></p>
      <p>过期时间：{{ new Date(props.outcome.expiresAt).toLocaleString() }}</p>
    </div>
    <div v-else-if="props.outcome.kind === 'session-draw-success'" class="result success" role="status">
      <p>免弹窗抽卡已确认（legacy）。剩余次数：{{ props.outcome.remainingCalls }}。</p>
      <p>UserOperation：<code>{{ props.outcome.userOpHash }}</code></p>
      <a v-if="props.outcome.txUrl" :href="props.outcome.txUrl" target="_blank" rel="noopener noreferrer">在 MonadVision 查看交易</a>
    </div>
    <p v-else class="result error" role="status">失败：{{ props.outcome.message }}</p>
  </section>
</template>

<style scoped>
.panel { padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 1rem; background: #fff; box-shadow: 0 8px 24px rgb(15 23 42 / 0.05); }.eyebrow{color:#6d28d9;font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}h2{margin:.35rem 0 .5rem;font-size:1.2rem;color:#111827}h3{margin:0 0 .4rem;color:#1f2937;font-size:1rem}.description,.help{color:#4b5563;line-height:1.6}button{width:100%;margin-top:.55rem;padding:.75rem 1rem;border:0;border-radius:.65rem;font:inherit;font-weight:700}button:disabled{cursor:not-allowed;background:#e5e7eb;color:#6b7280}.activate:not(:disabled){cursor:pointer;background:#6d28d9;color:#fff}.help{margin:.6rem 0 0;font-size:.88rem}.divider{height:1px;margin:1.35rem 0;background:#e5e7eb}.mode-badge{margin:0 0 .75rem;padding:.55rem .75rem;border-radius:.55rem;background:#f5f3ff;color:#4c1d95;font-size:.88rem;line-height:1.45}.mode-badge[data-mode="zodiac-roles-session"]{background:#ecfdf5;color:#065f46}.result{margin:1.1rem 0 0;padding:.75rem;border-radius:.65rem;background:#f9fafb;color:#374151;font-size:.9rem;line-height:1.55}.result.pending{background:#eff6ff;color:#1e3a8a}.result.success{background:#ecfdf5;color:#065f46}.result.success a{color:#047857;font-weight:700}.result.error{background:#fef2f2;color:#991b1b}code{overflow-wrap:anywhere}
</style>
