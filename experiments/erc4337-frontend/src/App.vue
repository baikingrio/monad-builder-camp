<script setup lang="ts">
import { connect, disconnect, getAccount, getBalance, switchChain } from '@wagmi/core'
import { formatUnits } from 'viem'
import { computed, onMounted, ref } from 'vue'
import { config } from './lib/wagmi'
import {
  ENTRY_POINT_V08,
  experiments,
  getExplorerAddressUrl,
  getExplorerTxUrl,
  monadTestnet,
  type Experiment
} from './lib/erc4337Experiments'

const account = ref<`0x${string}` | null>(null)
const balance = ref<string | null>(null)
const isBusy = ref(false)
const walletError = ref<string | null>(null)
const selectedExperiment = ref<Experiment>(experiments[0])

const shortAddress = computed(() => {
  if (!account.value) return ''
  return `${account.value.slice(0, 6)}…${account.value.slice(-4)}`
})

async function refreshWallet() {
  const current = getAccount(config)
  account.value = current.address ?? null

  if (current.address) {
    const result = await getBalance(config, { address: current.address, chainId: monadTestnet.id })
    balance.value = `${Number(formatUnits(result.value, result.decimals)).toFixed(4)} ${result.symbol}`
  } else {
    balance.value = null
  }
}

async function connectWallet() {
  isBusy.value = true
  walletError.value = null
  try {
    await connect(config, { connector: config.connectors[0] })
    await switchChain(config, { chainId: monadTestnet.id })
    await refreshWallet()
  } catch (error) {
    walletError.value = error instanceof Error ? error.message : '钱包连接失败，请确认浏览器钱包已解锁。'
  } finally {
    isBusy.value = false
  }
}

async function disconnectWallet() {
  await disconnect(config)
  account.value = null
  balance.value = null
}

onMounted(() => {
  refreshWallet().catch(() => undefined)
})
</script>

<template>
  <main class="page-shell">
    <section class="hero">
      <p class="eyebrow">MONAD TESTNET · ERC-4337 v0.8</p>
      <h1>Monad ERC-4337<br /><span>实验前端</span></h1>
      <p class="lead">把已经完成的 initCode、Paymaster 和 Session Key 链上实验，整理成一个可连接钱包、可查看 proof 的 Vue 3 前端。</p>
    </section>

    <section class="wallet-panel" aria-label="钱包连接区">
      <div>
        <p class="panel-label">钱包状态</p>
        <template v-if="account">
          <strong>{{ shortAddress }}</strong>
          <p>{{ balance ?? '正在读取余额…' }}</p>
        </template>
        <template v-else>
          <strong>尚未连接</strong>
          <p>连接钱包后可以读取 Monad Testnet 上的钱包余额。</p>
        </template>
      </div>
      <div class="wallet-actions">
        <button v-if="!account" type="button" :disabled="isBusy" @click="connectWallet">
          {{ isBusy ? '连接中…' : '连接钱包' }}
        </button>
        <button v-else class="secondary" type="button" @click="disconnectWallet">断开连接</button>
      </div>
      <p v-if="walletError" class="wallet-error">{{ walletError }}</p>
    </section>

    <section class="facts" aria-label="网络信息">
      <div><span>网络</span><strong>{{ monadTestnet.name }}</strong></div>
      <div><span>Chain ID</span><strong>{{ monadTestnet.id }}</strong></div>
      <div><span>EntryPoint</span><a :href="getExplorerAddressUrl(ENTRY_POINT_V08)" target="_blank" rel="noreferrer">{{ ENTRY_POINT_V08.slice(0, 10) }}…{{ ENTRY_POINT_V08.slice(-6) }}</a></div>
    </section>

    <section class="content-grid">
      <div class="experiment-list" aria-label="实验列表">
        <article
          v-for="experiment in experiments"
          :key="experiment.id"
          class="experiment-card"
          :class="{ active: selectedExperiment.id === experiment.id }"
          @click="selectedExperiment = experiment"
        >
          <div class="card-topline"><span class="status-dot"></span>{{ experiment.status }}</div>
          <h2>{{ experiment.title }}</h2>
          <p>{{ experiment.shortTitle }}</p>
          <button type="button" class="text-button" @click.stop="selectedExperiment = experiment">查看实验细节 →</button>
        </article>
      </div>

      <aside class="detail-panel" aria-live="polite">
        <p class="panel-label">实验细节</p>
        <h2>{{ selectedExperiment.title }}</h2>
        <p class="detail-summary">{{ selectedExperiment.summary }}</p>
        <div class="detail-block">
          <span>关键机制</span>
          <p>{{ selectedExperiment.howItWorks }}</p>
        </div>
        <div class="detail-block">
          <span>链上结果</span>
          <p>{{ selectedExperiment.result }}</p>
        </div>
        <div class="proof-list">
          <span>Proof</span>
          <ul>
            <li v-for="proof in selectedExperiment.proofs" :key="proof">{{ proof }}</li>
          </ul>
        </div>
        <a class="explorer-link" :href="getExplorerTxUrl(selectedExperiment.transactionHash)" target="_blank" rel="noreferrer">在 MonadVision 查看 handleOps 交易 ↗</a>
      </aside>
    </section>

    <footer>学习实验，不在前端保存私钥或 Session Key。真实产品应配合 Bundler、Paymaster 风控和安全的密钥管理。</footer>
  </main>
</template>
