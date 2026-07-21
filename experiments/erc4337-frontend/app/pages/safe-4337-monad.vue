<script setup lang="ts">
import { createPublicClient, http } from 'viem'
import { computed, ref } from 'vue'
import { monadTestnet } from '../lib/erc4337Experiments'
import {
  MONAD_ENTRY_POINT_V07,
  MONAD_SAFE_4337_MODULE,
  MONAD_SAFE_V141,
  MONAD_SAFE_4337_ZERO_VALUE_LEARNING_CASE,
  getMonadSafe4337LearningCaseStatus,
  getMonadSafe4337Readiness
} from '../lib/safe4337MonadConfig'

const isChecking = ref(false)
const checked = ref(false)
const status = ref('')
const codeChecks = ref<Record<string, boolean>>({})
const pimlicoApiKey = ref('')

try {
  pimlicoApiKey.value = String(useRuntimeConfig().public.NUXT_PUBLIC_MONAD_PIMLICO_API_KEY ?? '')
} catch {
  // Vitest/static rendering intentionally stays read-only without Nuxt runtime config.
}

const readiness = computed(() => getMonadSafe4337Readiness(pimlicoApiKey.value))
const learningCaseStatus = getMonadSafe4337LearningCaseStatus()
const contracts = [
  { name: 'Safe v1.4.1', address: MONAD_SAFE_V141 },
  { name: 'Safe 4337 Module', address: MONAD_SAFE_4337_MODULE },
  { name: 'EntryPoint v0.7', address: MONAD_ENTRY_POINT_V07 }
]

async function verifyContracts() {
  isChecking.value = true
  status.value = ''
  try {
    const client = createPublicClient({ chain: monadTestnet, transport: http(monadTestnet.rpcUrls.default.http[0]) })
    const results = await Promise.all(contracts.map(async (contract) => [contract.address, (await client.getCode({ address: contract.address as `0x${string}` })) !== undefined] as const))
    codeChecks.value = Object.fromEntries(results)
    checked.value = true
    status.value = results.every(([, hasCode]) => hasCode) ? '三项基础合约均在 Monad Testnet 返回链上代码。' : '有基础合约未返回代码，请停止后续集成并重新核对官方部署信息。'
  } catch (error) {
    status.value = error instanceof Error ? `读取 Monad RPC 失败：${error.message}` : '读取 Monad RPC 失败。'
  } finally {
    isChecking.value = false
  }
}
</script>

<template>
  <main class="page-shell">
    <section class="hero">
      <p class="eyebrow">MONAD TESTNET · SAFE · ERC-4337</p>
      <h1>Safe 4337<br /><span>Monad 实践</span></h1>
      <p class="lead">以官方已支持的 Safe 1.4.1、Safe 4337 Module 与 EntryPoint v0.7 为基础，先完成公开部署的可重复验证，再进入由用户明确触发的 Safe UserOperation 实验。</p>
    </section>

    <section class="wallet-panel" aria-label="推荐集成组合">
      <div>
        <p class="panel-label">官方支持的组合</p>
        <strong>Safe 1.4.1 + Safe 4337 Module + EntryPoint v0.7</strong>
        <p>Monad Testnet（Chain ID 10143）在 Safe 官方网络目录中列有 Safe Smart Account、Safe 4337 Module、Safe{Core} SDK、Safe{Wallet}、Transaction Service 与 Event Service。</p>
      </div>
    </section>

    <section class="facts" aria-label="Monad Safe 4337 基础合约">
      <div v-for="contract in contracts" :key="contract.address">
        <span>{{ contract.name }}</span>
        <a :href="`https://testnet.monadvision.com/address/${contract.address}`" target="_blank" rel="noreferrer">{{ contract.address.slice(0, 10) }}…{{ contract.address.slice(-6) }}</a>
        <small v-if="checked">{{ codeChecks[contract.address] ? '已验证有代码' : '未验证' }}</small>
      </div>
    </section>

    <section class="wallet-panel" aria-label="链上部署验证">
      <div>
        <p class="panel-label">步骤 1 · 只读验证</p>
        <strong>核对当前测试网部署</strong>
        <p>本页只读取公开链上代码，不创建 Safe、不请求签名、不发送 UserOperation。</p>
      </div>
      <div class="wallet-actions">
        <button type="button" :disabled="isChecking" @click="verifyContracts">{{ isChecking ? '读取中…' : '验证链上基础合约' }}</button>
      </div>
      <p v-if="status" class="wallet-error" role="status">{{ status }}</p>
    </section>

    <section class="wallet-panel" aria-label="预设 UserOperation 学习案例">
      <div>
        <p class="panel-label">步骤 2 · 仅供学习</p>
        <h2>预设 UserOperation 学习案例</h2>
        <p><strong>目标：</strong>{{ MONAD_SAFE_4337_ZERO_VALUE_LEARNING_CASE.target }}</p>
        <p><strong>Value：</strong>{{ MONAD_SAFE_4337_ZERO_VALUE_LEARNING_CASE.value }}</p>
        <p><strong>Calldata：</strong>{{ MONAD_SAFE_4337_ZERO_VALUE_LEARNING_CASE.calldata }}</p>
        <strong>发送前检查清单</strong>
        <ul>
          <li v-for="check in MONAD_SAFE_4337_ZERO_VALUE_LEARNING_CASE.preSendChecks" :key="check">{{ check }}</li>
        </ul>
        <p class="wallet-error" role="status">{{ learningCaseStatus.message }}</p>
      </div>
    </section>

    <section class="wallet-panel" aria-label="Passkey 支持边界">
      <div>
        <p class="panel-label">Passkey 边界</p>
        <strong>Safe Passkey Module 目前不在 Monad Testnet 的官方支持列表</strong>
        <p>因此本路线先实现标准 Safe 4337；若后续接入 WebAuthn，需按自部署 Passkey signer / verifier 的项目处理，不能复用 Sepolia 教程后直接宣称官方支持。</p>
      </div>
    </section>

    <section class="wallet-panel" aria-label="Pimlico 运行配置">
      <div>
        <p class="panel-label">步骤 2 · 发送前配置</p>
        <strong>{{ readiness.ready ? 'Pimlico Monad Testnet endpoint 已配置' : '尚未配置 Pimlico Monad Testnet endpoint' }}</strong>
        <p v-if="!readiness.ready" class="wallet-error">{{ readiness.message }}</p>
        <p v-else>Bundler 与 Paymaster 配置已就绪；真实 UserOperation 仍必须增加由用户确认的 Owner 签名和严格的赞助策略。</p>
      </div>
    </section>

    <footer>信息依据 Monad 与 Safe 官方网络目录。部署或发送 UserOperation 前，应再次验证地址、EntryPoint 版本、Bundler 兼容性与 Paymaster 赞助策略。</footer>
  </main>
</template>
