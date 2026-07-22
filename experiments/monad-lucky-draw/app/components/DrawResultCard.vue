<script setup lang="ts">
import type { DemoState } from '../lib/demoState'

const props = defineProps<{ state: DemoState; firstDrawAvailable: boolean }>()
</script>

<template>
  <section class="panel" aria-labelledby="draw-title">
    <div class="eyebrow">步骤 3</div>
    <h2 id="draw-title">激活与抽奖</h2>
    <p class="description">首次流程计划由 Sponsor 支持 Safe 激活与一次抽奖；本页仅展示前置条件，不执行 AA 或 Sponsor 请求。</p>
    <button
      type="button"
      :disabled="!props.firstDrawAvailable"
      aria-describedby="activation-help"
    >首次赞助激活并抽奖（尚不可用）</button>
    <p id="activation-help" class="help">登录、Safe 验证与 Sponsor 就绪后才可用；当前界面预览不会创建 UserOperation。</p>

    <div class="divider" aria-hidden="true"></div>
    <h3>后续抽奖</h3>
    <p class="description">计划中的免弹窗体验仅适用于已激活 Safe，且需要 Session Key 链上授权。</p>
    <button type="button" disabled aria-describedby="session-help">免弹窗抽奖（开发中）</button>
    <p id="session-help" class="help">需要 Session Key 链上授权；当前未实现 Session Key 创建、授权或执行。</p>
    <p class="result" role="status">暂无抽奖结果。本页面不会展示交易哈希、UserOperation 或成功记录。</p>
  </section>
</template>

<style scoped>
.panel { padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 1rem; background: #fff; box-shadow: 0 8px 24px rgb(15 23 42 / 0.05); }.eyebrow{color:#6d28d9;font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}h2{margin:.35rem 0 .5rem;font-size:1.2rem;color:#111827}h3{margin:0 0 .4rem;color:#1f2937;font-size:1rem}.description,.help{color:#4b5563;line-height:1.6}button{width:100%;margin-top:.55rem;padding:.75rem 1rem;border:0;border-radius:.65rem;font:inherit;font-weight:700}button:disabled{cursor:not-allowed;background:#e5e7eb;color:#6b7280}.help{margin:.6rem 0 0;font-size:.88rem}.divider{height:1px;margin:1.35rem 0;background:#e5e7eb}.result{margin:1.1rem 0 0;padding:.75rem;border-radius:.65rem;background:#f9fafb;color:#374151;font-size:.9rem;line-height:1.55}
</style>
