<script setup lang="ts">
import { computed } from 'vue'
import type { DemoState } from '../lib/demoState'

const props = defineProps<{ state: DemoState }>()
const emit = defineEmits<{ 'check-deployment-status': [] }>()

const canCheckDeployment = computed(() => props.state.authenticated && props.state.safeDerivationVerified && Boolean(props.state.counterfactualSafeAddress))
const deploymentLabel = computed(() => ({
  unknown: '未知（尚未检查）',
  deployed: '已部署（链上只读检查）',
  'not-deployed': '未部署（链上只读检查）',
  unavailable: '无法获取（RPC 不可用）'
}[props.state.safeDeploymentStatus]))
const deploymentExplanation = computed(() => ({
  unknown: 'Safe 地址派生不等于部署。请在已认证且完成地址派生后，点击按钮发起一次只读 eth_getCode 检查。',
  deployed: 'eth_getCode 返回了非空代码。这是只读结果，不代表本页面发送过交易或 UserOperation。',
  'not-deployed': 'eth_getCode 返回 0x；这是只读结果，不代表本页面执行过部署、交易或 UserOperation。',
  unavailable: '服务端读取 Monad Testnet eth_getCode 失败。请确认网络可达、NUXT_PUBLIC_MONAD_RPC_URL 正确，然后重试。'
}[props.state.safeDeploymentStatus]))
</script>

<template>
  <section class="panel" aria-labelledby="safe-title">
    <div class="eyebrow">步骤 2</div>
    <h2 id="safe-title">反事实 Safe</h2>
    <p class="description">Safe 地址仅在登录绑定 EOA 与固定 Monad 工厂配置验证后，以 SafeProxyFactory 的 CREATE2 规则离线推导。链上状态检查仅使用 Monad Testnet 的只读 eth_getCode。</p>
    <div class="safe-state" aria-live="polite">
      <span class="state-label">部署状态</span>
      <strong>{{ deploymentLabel }}</strong>
    </div>
    <p class="warning">{{ deploymentExplanation }}</p>
    <button type="button" class="check-button" :disabled="!canCheckDeployment" @click="emit('check-deployment-status')">检查 Safe 链上状态</button>
    <p v-if="!canCheckDeployment" class="hint">请先完成认证与 Safe 地址派生；在此之前不会发起 RPC 请求。</p>
    <div v-if="state.safeDerivationVerified && state.counterfactualSafeAddress" class="safe-address">
      <span>反事实 Safe 地址</span>
      <code>{{ state.counterfactualSafeAddress }}</code>
      <a :href="`https://testnet.monadexplorer.com/address/${state.counterfactualSafeAddress}`" target="_blank" rel="noopener noreferrer">在 Monad Explorer 查看地址</a>
    </div>
    <ul>
      <li>登录与 EOA 绑定：{{ state.authenticated ? '已验证' : '未就绪' }}</li>
      <li>Safe 派生验证：{{ state.safeDerivationVerified ? '已验证' : '未就绪' }}</li>
      <li>链上部署确认：{{ state.safeDeploymentStatus === 'unknown' ? '尚未请求只读检查' : '已完成只读检查' }}</li>
    </ul>
  </section>
</template>

<style scoped>
.panel { padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 1rem; background: #fff; box-shadow: 0 8px 24px rgb(15 23 42 / 0.05); }
.eyebrow { color: #6d28d9; font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; } h2 { margin: .35rem 0 .5rem; font-size: 1.2rem; color: #111827; }
.description, li, .hint { color: #4b5563; line-height: 1.6; }.safe-state { display:flex; justify-content:space-between; align-items:center; margin:1.2rem 0 .75rem; padding: .85rem 1rem; border-radius:.7rem; background:#fff7ed; }.state-label{color:#9a3412}.safe-state strong{color:#c2410c}.warning{margin:0;padding:.75rem;border-left:3px solid #f59e0b;background:#fffbeb;color:#78350f;line-height:1.55}.check-button{margin-top:.75rem;padding:.65rem .85rem;border:0;border-radius:.55rem;background:#6d28d9;color:#fff;font-weight:700;cursor:pointer}.check-button:disabled{background:#9ca3af;cursor:not-allowed}.hint{margin:.5rem 0 0;font-size:.9rem}.safe-address{margin-top:.75rem;padding:.75rem;border:1px solid #ddd6fe;border-radius:.6rem;background:#f5f3ff;color:#4c1d95}.safe-address span{display:block;font-size:.8rem;font-weight:700}.safe-address code{display:block;overflow-wrap:anywhere;margin-top:.3rem;color:#312e81}.safe-address a{display:inline-block;margin-top:.5rem;color:#5b21b6;font-weight:700}ul{margin:1rem 0 0;padding-left:1.2rem}
</style>
