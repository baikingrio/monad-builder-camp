<script setup lang="ts">
import type { DemoState } from '../lib/demoState'
import type { ActivationReadiness } from '../lib/activationReadiness'

const props = defineProps<{ state: DemoState; firstDrawAvailable: boolean; activationReadiness?: ActivationReadiness }>()
</script>

<template>
  <section class="panel" aria-labelledby="draw-title">
    <div class="eyebrow">步骤 3</div>
    <h2 id="draw-title">激活与抽奖</h2>
    <p class="description">本页只展示固定的 v0.7 UserOperation 模拟准备条件；Sponsor、Bundler 与实际执行全部保持禁用。</p>
    <button
      type="button"
      disabled
      aria-describedby="activation-help"
    >模拟激活并抽卡（仅就绪预览）</button>
    <p id="activation-help" class="help">此预览不签名、不发送、不部署 Safe，也不会联系 Bundler 或 Sponsor。只有已认证 EOA、确认未部署的反事实 Safe 与明确用户点击才可在服务器获得只读就绪状态。</p>
    <p v-if="props.activationReadiness && !props.activationReadiness.canConstructUserOperation" class="help readiness" role="status">
      真实激活仍已禁用：{{ props.activationReadiness.blockers.join('；') }}。不会请求签名、调用 Bundler 或广播 UserOperation。
    </p>

    <div class="divider" aria-hidden="true"></div>
    <h3>后续抽奖</h3>
    <p class="description">计划中的免弹窗体验仅适用于已激活 Safe，且需要 Session Key 链上授权。</p>
    <button type="button" disabled aria-describedby="session-help">免弹窗抽奖（开发中）</button>
    <p id="session-help" class="help">需要 Session Key 链上授权；当前未实现 Session Key 创建、授权或执行。</p>
    <p class="result" role="status">暂无抽奖结果。本页面不会展示交易哈希、UserOperation 或成功记录。</p>
  </section>
</template>

<style scoped>
.panel { padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 1rem; background: #fff; box-shadow: 0 8px 24px rgb(15 23 42 / 0.05); }.eyebrow{color:#6d28d9;font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}h2{margin:.35rem 0 .5rem;font-size:1.2rem;color:#111827}h3{margin:0 0 .4rem;color:#1f2937;font-size:1rem}.description,.help{color:#4b5563;line-height:1.6}button{width:100%;margin-top:.55rem;padding:.75rem 1rem;border:0;border-radius:.65rem;font:inherit;font-weight:700}button:disabled{cursor:not-allowed;background:#e5e7eb;color:#6b7280}.help{margin:.6rem 0 0;font-size:.88rem}.readiness{padding:.7rem;border-left:3px solid #f59e0b;background:#fffbeb;color:#78350f}.divider{height:1px;margin:1.35rem 0;background:#e5e7eb}.result{margin:1.1rem 0 0;padding:.75rem;border-radius:.65rem;background:#f9fafb;color:#374151;font-size:.9rem;line-height:1.55}
</style>
