<script setup lang="ts">
import type { DemoState } from '../lib/demoState'

defineProps<{ state: DemoState }>()
</script>

<template>
  <section class="panel" aria-labelledby="wallet-title">
    <div class="eyebrow">步骤 1</div>
    <h2 id="wallet-title">EOA 身份绑定</h2>
    <p class="description">先连接 EOA，再以该账户完成登录；Safe 与后续权限都只绑定这一身份。</p>
    <dl class="status-list">
      <div>
        <dt>钱包连接</dt>
        <dd>{{ state.walletConnected ? '已连接' : '尚未连接真实钱包' }}</dd>
      </div>
      <div>
        <dt>登录验证</dt>
        <dd>{{ state.authenticated ? '已验证' : '尚未实现' }}</dd>
      </div>
      <div>
        <dt>网络</dt>
        <dd>{{ state.onMonadTestnet ? 'Monad Testnet 已验证' : '等待 Monad Testnet 验证' }}</dd>
      </div>
    </dl>
    <p class="notice" role="note">界面预览 / 尚未连接真实钱包。此版本不会读取钱包、请求签名或发送交易。</p>
    <button type="button" disabled aria-describedby="wallet-unavailable">连接钱包（开发中）</button>
    <p id="wallet-unavailable" class="help">真实钱包连接与登录将在后续任务接入。</p>
  </section>
</template>

<style scoped>
.panel { padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 1rem; background: #fff; box-shadow: 0 8px 24px rgb(15 23 42 / 0.05); }
.eyebrow { color: #6d28d9; font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
h2 { margin: .35rem 0 .5rem; font-size: 1.2rem; color: #111827; }
.description, .help { color: #4b5563; line-height: 1.6; }
.status-list { display: grid; gap: .65rem; margin: 1.25rem 0; }
.status-list div { display: flex; justify-content: space-between; gap: 1rem; padding-bottom: .55rem; border-bottom: 1px solid #f3f4f6; }
dt { color: #6b7280; } dd { margin: 0; color: #1f2937; font-weight: 600; text-align: right; }
.notice { padding: .75rem; border-radius: .65rem; background: #f5f3ff; color: #5b21b6; line-height: 1.55; }
button { width: 100%; margin-top: .3rem; padding: .75rem 1rem; border: 0; border-radius: .65rem; font: inherit; font-weight: 700; } button:disabled { cursor: not-allowed; background: #e5e7eb; color: #6b7280; }
.help { margin: .6rem 0 0; font-size: .88rem; }
</style>
