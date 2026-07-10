<script setup lang="ts">
import { connect, disconnect, getAccount, switchChain, writeContract } from '@wagmi/core'
import { createPublicClient, formatUnits, http, type Hash } from 'viem'
import { computed, onMounted, ref } from 'vue'
import {
  erc1363TokenAbi,
  erc1363VaultAbi,
  getErc1363Deployment,
  parseTokenAmount
} from '../lib/erc1363'
import { monadTestnet } from '../lib/erc4337Experiments'
import { config } from '../lib/wagmi'

const runtimeConfig = useRuntimeConfig()
const deployment = getErc1363Deployment({
  tokenAddress: runtimeConfig.public.ERC1363_TOKEN_ADDRESS,
  vaultAddress: runtimeConfig.public.ERC1363_VAULT_ADDRESS
})

const account = ref<`0x${string}` | null>(null)
const isBusy = ref(false)
const isReading = ref(false)
const errorMessage = ref<string | null>(null)
const txHash = ref<Hash | null>(null)
const stakeInput = ref('')
const withdrawInput = ref('')
const tokenDecimals = ref(18)
const tokenSymbol = ref('TOKEN')
const tokenBalance = ref<bigint | null>(null)
const stakedBalance = ref<bigint | null>(null)
const pendingRewards = ref<bigint | null>(null)

const configured = computed(() => deployment !== null)
const shortAddress = computed(() => account.value ? `${account.value.slice(0, 6)}…${account.value.slice(-4)}` : '')
const explorerTxUrl = computed(() => txHash.value ? `${monadTestnet.blockExplorers.default.url}/tx/${txHash.value}` : '')
const displayAmount = (amount: bigint | null) => amount === null ? '—' : `${formatUnits(amount, tokenDecimals.value)} ${tokenSymbol.value}`
const writesDisabled = computed(() => !configured.value || !account.value || isBusy.value)

function errorText(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请检查钱包、网络和合约状态。'
}

async function refreshWalletAndBalances() {
  if (!import.meta.client) return
  account.value = getAccount(config).address ?? null
  if (!deployment || !account.value) {
    tokenBalance.value = null
    stakedBalance.value = null
    pendingRewards.value = null
    return
  }

  isReading.value = true
  try {
    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(monadTestnet.rpcUrls.default.http[0])
    })
    const [decimals, symbol, balance, staked, rewards] = await Promise.all([
      publicClient.readContract({ address: deployment.tokenAddress, abi: erc1363TokenAbi, functionName: 'decimals' }),
      publicClient.readContract({ address: deployment.tokenAddress, abi: erc1363TokenAbi, functionName: 'symbol' }),
      publicClient.readContract({ address: deployment.tokenAddress, abi: erc1363TokenAbi, functionName: 'balanceOf', args: [account.value] }),
      publicClient.readContract({ address: deployment.vaultAddress, abi: erc1363VaultAbi, functionName: 'stakedBalance', args: [account.value] }),
      publicClient.readContract({ address: deployment.vaultAddress, abi: erc1363VaultAbi, functionName: 'pendingRewards', args: [account.value] })
    ])
    tokenDecimals.value = Number(decimals)
    tokenSymbol.value = symbol
    tokenBalance.value = balance
    stakedBalance.value = staked
    pendingRewards.value = rewards
  } catch (error) {
    errorMessage.value = `读取合约数据失败：${errorText(error)}`
  } finally {
    isReading.value = false
  }
}

async function connectWallet() {
  if (!import.meta.client) return
  isBusy.value = true
  errorMessage.value = null
  try {
    await connect(config, { connector: config.connectors[0] })
    await switchChain(config, { chainId: monadTestnet.id })
    await refreshWalletAndBalances()
  } catch (error) {
    errorMessage.value = `钱包连接失败：${errorText(error)}`
  } finally {
    isBusy.value = false
  }
}

async function disconnectWallet() {
  await disconnect(config)
  account.value = null
  tokenBalance.value = null
  stakedBalance.value = null
  pendingRewards.value = null
}

async function submitWrite(kind: 'stake' | 'claim' | 'withdraw') {
  if (!deployment || !account.value || isBusy.value) return
  isBusy.value = true
  errorMessage.value = null
  txHash.value = null
  try {
    if (kind === 'stake') {
      const amount = parseTokenAmount(stakeInput.value, tokenDecimals.value)
      txHash.value = await writeContract(config, {
        chainId: monadTestnet.id,
        address: deployment.tokenAddress,
        abi: erc1363TokenAbi,
        functionName: 'transferAndCall',
        args: [deployment.vaultAddress, amount, '0x']
      })
      stakeInput.value = ''
    } else if (kind === 'claim') {
      txHash.value = await writeContract(config, {
        chainId: monadTestnet.id,
        address: deployment.vaultAddress,
        abi: erc1363VaultAbi,
        functionName: 'claim'
      })
    } else {
      const amount = parseTokenAmount(withdrawInput.value, tokenDecimals.value)
      txHash.value = await writeContract(config, {
        chainId: monadTestnet.id,
        address: deployment.vaultAddress,
        abi: erc1363VaultAbi,
        functionName: 'withdraw',
        args: [amount]
      })
      withdrawInput.value = ''
    }
  } catch (error) {
    errorMessage.value = `交易未发送：${errorText(error)}`
  } finally {
    isBusy.value = false
  }
}

onMounted(() => {
  refreshWalletAndBalances().catch(() => undefined)
})
</script>

<template>
  <main class="erc1363-page">
    <header>
      <p class="eyebrow">MONAD TESTNET · ERC-1363</p>
      <h1>ERC-1363 质押分红</h1>
      <p>使用 <code>transferAndCall</code> 直接质押代币；领取分红与提取质押均由你的浏览器钱包签名。</p>
    </header>

    <section class="testnet-warning" aria-label="测试网提示">
      <strong>仅限 Monad Testnet（Chain ID {{ monadTestnet.id }}）。</strong>
      请确认钱包已切换至测试网，并仅使用测试代币；每次操作都会请求钱包确认。
    </section>

    <section v-if="!configured" class="configuration-warning" aria-live="polite">
      <h2>未配置合约地址</h2>
      <p>部署后设置公开运行时变量 <code>NUXT_PUBLIC_ERC1363_TOKEN_ADDRESS</code> 与 <code>NUXT_PUBLIC_ERC1363_VAULT_ADDRESS</code>，然后重新启动应用。当前页面不会读取合约或发送交易。</p>
    </section>

    <section v-else class="deployment" aria-label="已配置合约">
      <span>Token: <code>{{ deployment?.tokenAddress }}</code></span>
      <span>Vault: <code>{{ deployment?.vaultAddress }}</code></span>
    </section>

    <section class="wallet-panel" aria-label="钱包">
      <div>
        <strong>{{ account ? shortAddress : '尚未连接钱包' }}</strong>
        <p>{{ account ? '已连接；交易将由此地址签名。' : '连接注入式浏览器钱包以读取余额和发送交易。' }}</p>
      </div>
      <div class="actions">
        <button v-if="!account" type="button" :disabled="isBusy" @click="connectWallet">{{ isBusy ? '连接中…' : '连接钱包' }}</button>
        <button v-else type="button" class="secondary" @click="disconnectWallet">断开连接</button>
        <button v-if="configured && account" type="button" class="secondary" :disabled="isReading" @click="refreshWalletAndBalances">{{ isReading ? '读取中…' : '刷新余额' }}</button>
      </div>
    </section>

    <section class="balances" aria-label="质押数据">
      <article><span>钱包代币余额</span><strong>{{ displayAmount(tokenBalance) }}</strong></article>
      <article><span>已质押</span><strong>{{ displayAmount(stakedBalance) }}</strong></article>
      <article><span>待领取分红</span><strong>{{ displayAmount(pendingRewards) }}</strong></article>
    </section>

    <section class="write-grid" aria-label="质押操作">
      <form @submit.prevent="submitWrite('stake')">
        <h2>质押</h2>
        <p>调用 Token 的 <code>transferAndCall(vault, amount, 0x)</code>。</p>
        <label>数量 <input v-model="stakeInput" inputmode="decimal" placeholder="例如 10" :disabled="writesDisabled" /></label>
        <button type="submit" :disabled="writesDisabled">质押</button>
      </form>
      <article>
        <h2>领取分红</h2>
        <p>调用 Vault 的 <code>claim()</code>。</p>
        <button type="button" :disabled="writesDisabled" @click="submitWrite('claim')">领取分红</button>
      </article>
      <form @submit.prevent="submitWrite('withdraw')">
        <h2>提取质押</h2>
        <p>调用 Vault 的 <code>withdraw(amount)</code>。</p>
        <label>数量 <input v-model="withdrawInput" inputmode="decimal" placeholder="例如 10" :disabled="writesDisabled" /></label>
        <button type="submit" :disabled="writesDisabled">提取质押</button>
      </form>
    </section>

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <p v-if="txHash" class="transaction" aria-live="polite">交易已提交：<a :href="explorerTxUrl" target="_blank" rel="noreferrer">在 MonadVision 查看 {{ txHash.slice(0, 10) }}…{{ txHash.slice(-6) }} ↗</a></p>
  </main>
</template>

<style scoped>
.erc1363-page { max-width: 1000px; margin: 0 auto; padding: 3rem 1.25rem; color: #e9eefb; }
.eyebrow { color: #8da4ff; font-weight: 700; letter-spacing: .08em; }
h1 { font-size: clamp(2rem, 6vw, 3.5rem); margin: .4rem 0; } h2 { margin-top: 0; }
.testnet-warning, .configuration-warning, .wallet-panel, .deployment, .balances article, .write-grid > * { border: 1px solid #33415f; border-radius: 12px; padding: 1.25rem; background: #151d31; }
.testnet-warning { margin: 1.5rem 0; border-color: #a77a25; background: #2c2414; } .configuration-warning { border-color: #a55d35; background: #2f1d18; }
.deployment { display: grid; gap: .5rem; margin: 1rem 0; overflow-wrap: anywhere; } .wallet-panel { display: flex; justify-content: space-between; gap: 1rem; align-items: center; margin: 1rem 0; }
.actions { display: flex; flex-wrap: wrap; gap: .6rem; } button { border: 0; border-radius: 8px; background: #708cff; color: #0c1120; padding: .7rem 1rem; font-weight: 700; cursor: pointer; } button.secondary { background: #31405f; color: #e9eefb; } button:disabled, input:disabled { cursor: not-allowed; opacity: .55; }
.balances, .write-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; margin: 1rem 0; }.balances span { display: block; color: #aeb9d2; margin-bottom: .45rem; }.balances strong { overflow-wrap: anywhere; }
.write-grid > * { display: flex; flex-direction: column; gap: .9rem; }.write-grid button { margin-top: auto; } label { display: grid; gap: .35rem; } input { border: 1px solid #52617e; border-radius: 7px; padding: .65rem; background: #0e1525; color: inherit; } .error { color: #ff9f90; } a { color: #a9b9ff; }
@media (max-width: 700px) { .wallet-panel { align-items: stretch; flex-direction: column; }.balances, .write-grid { grid-template-columns: 1fr; } }
</style>
