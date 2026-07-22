<script setup lang="ts">
import type { DemoState } from '../lib/demoState'

defineProps<{ state: DemoState }>()
</script>

<template>
  <section class="panel" aria-labelledby="safe-title">
    <div class="eyebrow">步骤 2</div>
    <h2 id="safe-title">反事实 Safe</h2>
    <p class="description">Safe 地址须在登录绑定的 EOA 与工厂参数均验证后才能显示；当前不推导、不查询链上状态。</p>
    <div class="safe-state" aria-live="polite">
      <span class="state-label">部署状态</span>
      <strong>{{ state.safeDeployed ? '已部署' : '未部署' }}</strong>
    </div>
    <p v-if="!state.safeDerivationVerified" class="warning">尚未验证 Safe 派生，因此不展示或声称任何 Safe 地址。</p>
    <p v-else class="warning">Safe 已派生待部署；部署状态仍须由链上确认。</p>
    <ul>
      <li>登录与 EOA 绑定：{{ state.authenticated ? '已验证' : '未就绪' }}</li>
      <li>Safe 派生验证：{{ state.safeDerivationVerified ? '已验证' : '未就绪' }}</li>
      <li>链上部署确认：{{ state.safeDeployed ? '已确认' : '未确认' }}</li>
    </ul>
  </section>
</template>

<style scoped>
.panel { padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 1rem; background: #fff; box-shadow: 0 8px 24px rgb(15 23 42 / 0.05); }
.eyebrow { color: #6d28d9; font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; } h2 { margin: .35rem 0 .5rem; font-size: 1.2rem; color: #111827; }
.description, li { color: #4b5563; line-height: 1.6; }.safe-state { display:flex; justify-content:space-between; align-items:center; margin:1.2rem 0 .75rem; padding: .85rem 1rem; border-radius:.7rem; background:#fff7ed; }.state-label{color:#9a3412}.safe-state strong{color:#c2410c}.warning{margin:0;padding:.75rem;border-left:3px solid #f59e0b;background:#fffbeb;color:#78350f;line-height:1.55}ul{margin:1rem 0 0;padding-left:1.2rem}
</style>
