<script setup lang="ts">
import { createPublicClient, http, type Address, type Hex } from 'viem'
import { computed, onMounted, ref } from 'vue'
import {
  EIP7702_DELEGATED_EOA,
  EIP7702_EXECUTOR,
  EIP7702_RELAYER,
  EIP7702_TARGET,
  EIP7702_TYPE04_TX_HASH,
  erc7702ExecutorAbi,
  erc7702TargetAbi
} from '../lib/erc7702'
import { monadTestnet } from '../lib/erc4337Experiments'

const isReading = ref(false)
const readError = ref<string | null>(null)
const checkInCount = ref<bigint | null>(null)
const lastActor = ref<Address | null>(null)
const configuredRelayer = ref<Address | null>(null)
const configuredTarget = ref<Address | null>(null)
const delegatedEoaCode = ref<Hex | null>(null)

const explorer = monadTestnet.blockExplorers.default.url
const type04TxUrl = `${explorer}/tx/${EIP7702_TYPE04_TX_HASH}`
const targetUrl = `${explorer}/address/${EIP7702_TARGET}`
const executorUrl = `${explorer}/address/${EIP7702_EXECUTOR}`
const eoaUrl = `${explorer}/address/${EIP7702_DELEGATED_EOA}`
const relayerUrl = `${explorer}/address/${EIP7702_RELAYER}`
const delegationIndicator = computed(() => delegatedEoaCode.value ? `${delegatedEoaCode.value.slice(0, 10)}…${delegatedEoaCode.value.slice(-8)}` : '读取中…')

function textOf(error: unknown) {
  return error instanceof Error ? error.message : '未知 RPC 错误'
}

/** 只读 Monad Testnet 的已部署合约与 EOA code；不请求钱包权限，也不会创建交易。 */
async function refreshOnChainState() {
  if (!import.meta.client) return
  isReading.value = true
  readError.value = null
  try {
    const client = createPublicClient({ chain: monadTestnet, transport: http(monadTestnet.rpcUrls.default.http[0]) })
    const [count, actor, relayer, target, eoaCode] = await Promise.all([
      client.readContract({ address: EIP7702_TARGET, abi: erc7702TargetAbi, functionName: 'checkInCount' }),
      client.readContract({ address: EIP7702_TARGET, abi: erc7702TargetAbi, functionName: 'lastActor' }),
      client.readContract({ address: EIP7702_EXECUTOR, abi: erc7702ExecutorAbi, functionName: 'relayer' }),
      client.readContract({ address: EIP7702_EXECUTOR, abi: erc7702ExecutorAbi, functionName: 'target' }),
      client.getBytecode({ address: EIP7702_DELEGATED_EOA })
    ])
    checkInCount.value = count
    lastActor.value = actor
    configuredRelayer.value = relayer
    configuredTarget.value = target
    delegatedEoaCode.value = eoaCode ?? null
  } catch (error) {
    readError.value = `读取 Monad Testnet 失败：${textOf(error)}`
  } finally {
    isReading.value = false
  }
}

onMounted(() => {
  refreshOnChainState().catch(() => undefined)
})
</script>

<template>
  <main class="erc7702-page">
    <header class="hero">
      <p class="eyebrow">MONAD TESTNET · EIP-7702 · TYPE 0x04</p>
      <h1>ERC-7702 真实链上 Demo</h1>
      <p>已在 Monad Testnet 完成 type-0x04 交易：课程 EOA 授权委托受限执行器，由固定 relayer 支付 Gas，并在同一笔交易中真实执行两次链上 check-in。</p>
      <a href="/" class="back-link">← 返回 ERC-4337 实验</a>
    </header>

    <section class="real-warning" aria-label="真实链上边界">
      <strong>前端只做公开链上读取，不保存私钥、不代替用户签名，也不在浏览器广播交易。</strong>
      <p>本页展示的地址、交易和状态均可在 MonadVision 验证；relayer 私钥仅存在本地 `.env`，没有进入前端包。</p>
    </section>

    <section class="proof-links" aria-label="公开链上 Proof">
      <a :href="type04TxUrl" target="_blank" rel="noreferrer">查看 type-0x04 交易 ↗</a>
      <a :href="targetUrl" target="_blank" rel="noreferrer">查看 CheckIn Target ↗</a>
      <a :href="executorUrl" target="_blank" rel="noreferrer">查看受限 Executor ↗</a>
      <a :href="eoaUrl" target="_blank" rel="noreferrer">查看已委托 EOA ↗</a>
    </section>

    <section class="flow" aria-label="真实链上执行步骤">
      <article><span>1</span><div><strong>部署固定功能合约</strong><p>部署 Target 与 Executor。Executor 不接受任意 calldata 或转账，只能调用固定 Target 两次。</p></div></article>
      <article><span>2</span><div><strong>独立 relayer 支付 Gas</strong><p>由于 Monad 对 delegated EOA 有余额规则，type-0x04 交易由固定 relayer 提交和付费，EOA 资产余额不被扣减。</p></div></article>
      <article><span>3</span><div><strong>提交真实授权列表</strong><p>课程 EOA 的链绑定授权被放入 type `0x04` 交易；EOA code 变为 delegation indicator 并指向 Executor。</p></div></article>
      <article><span>4</span><div><strong>原子执行两次 check-in</strong><p>Executor 在委托 EOA 上下文调用 Target 两次。Target 记录的 `lastActor` 应为该 EOA，计数应为 `2`。</p></div></article>
    </section>

    <section class="state-panel" aria-label="真实链上状态">
      <div class="state-heading">
        <div><p class="panel-label">真实链上状态</p><h2>直接从 Monad Testnet RPC 读取</h2></div>
        <button type="button" :disabled="isReading" @click="refreshOnChainState">{{ isReading ? '读取中…' : '刷新链上状态' }}</button>
      </div>
      <div class="state-grid">
        <article><span>checkInCount</span><strong>{{ checkInCount === null ? '—' : checkInCount.toString() }}</strong></article>
        <article><span>Target 看到的 lastActor</span><code>{{ lastActor ?? '—' }}</code></article>
        <article><span>Executor 固定 relayer</span><code>{{ configuredRelayer ?? '—' }}</code></article>
        <article><span>Executor 固定 target</span><code>{{ configuredTarget ?? '—' }}</code></article>
        <article><span>已委托 EOA code</span><code>{{ delegationIndicator }}</code></article>
        <article><span>交易提交 relayer</span><a :href="relayerUrl" target="_blank" rel="noreferrer">{{ EIP7702_RELAYER }}</a></article>
      </div>
      <p v-if="readError" class="error" role="alert">{{ readError }}</p>
    </section>

    <section class="addresses" aria-label="核心地址">
      <p><span>Delegated EOA</span><code>{{ EIP7702_DELEGATED_EOA }}</code></p>
      <p><span>CheckIn Target</span><code>{{ EIP7702_TARGET }}</code></p>
      <p><span>Relayed Executor</span><code>{{ EIP7702_EXECUTOR }}</code></p>
      <p><span>Type-0x04 Tx</span><code>{{ EIP7702_TYPE04_TX_HASH }}</code></p>
    </section>
  </main>
</template>

<style scoped>
.erc7702-page { max-width: 1080px; margin: 0 auto; padding: 3rem 1.25rem 4rem; color: #e9eefb; }.hero { max-width: 800px; }.eyebrow,.panel-label { color: #8da4ff; font-weight: 700; letter-spacing: .08em; }.hero h1 { font-size: clamp(2.2rem, 7vw, 4.1rem); margin: .4rem 0 1rem; }.hero p { color: #b6c2dd; font-size: 1.1rem; line-height: 1.65; }.back-link,a { color: #a9b9ff; }
.real-warning,.state-panel,.flow article,.state-grid article,.addresses { border: 1px solid #33415f; border-radius: 14px; background: #151d31; }.real-warning { margin: 2rem 0 1rem; padding: 1.15rem 1.3rem; border-color: #367a68; background: #142b28; }.real-warning p { margin-bottom: 0; color: #b8dfd4; }.proof-links { display: flex; flex-wrap: wrap; gap: .7rem; margin-bottom: 1rem; }.proof-links a { border: 1px solid #53668f; border-radius: 9px; padding: .65rem .8rem; text-decoration: none; }
.flow { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1rem; }.flow article { display: flex; gap: .8rem; padding: 1.1rem; }.flow article > span { display:grid; place-items:center; flex:0 0 1.8rem; height:1.8rem; border-radius:999px; background:#708cff; color:#0c1120; font-weight:800; }.flow p { color:#b6c2dd; line-height:1.55; margin:.3rem 0 0; }
.state-panel { padding:1.3rem; margin:1rem 0; }.state-heading { display:flex; align-items:start; justify-content:space-between; gap:1rem; }.state-heading h2 { margin:.25rem 0 1rem; }.state-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.8rem; }.state-grid article { padding:1rem; overflow-wrap:anywhere; }.state-grid span,.addresses span { display:block; color:#9eacca; font-size:.85rem; margin-bottom:.45rem; }.state-grid strong { color:#aef0c8; font-size:1.5rem; }.state-grid code,.addresses code { color:#c7d3ff; overflow-wrap:anywhere; }.error { color:#ff9f90; } button { border:0; border-radius:8px; background:#708cff; color:#0c1120; padding:.7rem 1rem; font-weight:700; cursor:pointer; } button:disabled { opacity:.55; cursor:not-allowed; }.addresses { padding:1.1rem; }.addresses p { margin:.75rem 0; overflow-wrap:anywhere; }
@media (max-width:720px) { .flow,.state-grid { grid-template-columns:1fr; }.state-heading { flex-direction:column; align-items:stretch; } }
</style>
