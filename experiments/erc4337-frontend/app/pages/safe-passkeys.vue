<script setup lang="ts">
import type { PasskeyArgType } from '@safe-global/protocol-kit'
import { computed, onMounted, ref } from 'vue'
import { loadPasskeys, savePasskey } from '../lib/passkeys'
import { createBrowserPasskey, getSafeAccountInfo, mintPracticeNft } from '../lib/safePasskeyActions'
import { getSafePasskeyReadiness } from '../lib/safePasskeyConfig'

const passkeys = ref<PasskeyArgType[]>([])
const selectedPasskey = ref<PasskeyArgType | null>(null)
const safeAddress = ref('')
const isDeployed = ref(false)
const isBusy = ref(false)
const status = ref('')
const pimlicoApiKey = ref('')

const readiness = computed(() => getSafePasskeyReadiness(pimlicoApiKey.value))
const canMint = computed(() => selectedPasskey.value !== null && safeAddress.value !== '' && readiness.value.ready && !isBusy.value)
const shortAddress = computed(() => safeAddress.value ? `${safeAddress.value.slice(0, 6)}…${safeAddress.value.slice(-4)}` : '')

function setRuntimeConfig() {
  try {
    pimlicoApiKey.value = String(useRuntimeConfig().public.NUXT_PUBLIC_PIMLICO_API_KEY ?? '')
  } catch {
    // Vitest and static previews have no Nuxt runtime config; the UI remains safely read-only.
  }
}

async function refreshSafeInfo(passkey: PasskeyArgType) {
  if (!readiness.value.ready) {
    status.value = readiness.value.message
    return
  }
  const info = await getSafeAccountInfo(passkey, readiness.value)
  safeAddress.value = info.address
  isDeployed.value = info.isDeployed
}

async function createPasskey() {
  if (!window.PublicKeyCredential) {
    status.value = '当前浏览器不支持 Passkeys。请使用 Chrome 或 Chromium。'
    return
  }

  isBusy.value = true
  status.value = ''
  try {
    const passkey = await createBrowserPasskey()
    savePasskey(localStorage, passkey)
    passkeys.value = loadPasskeys(localStorage)
    selectedPasskey.value = passkey
    await refreshSafeInfo(passkey)
    if (!status.value) status.value = 'Passkey 已创建并仅保存在当前浏览器。'
  } catch (error) {
    status.value = error instanceof Error ? error.message : '创建 Passkey 失败。'
  } finally {
    isBusy.value = false
  }
}

async function choosePasskey(passkey: PasskeyArgType) {
  selectedPasskey.value = passkey
  safeAddress.value = ''
  status.value = ''
  isBusy.value = true
  try {
    await refreshSafeInfo(passkey)
  } catch (error) {
    status.value = error instanceof Error ? error.message : '读取 Safe 状态失败。'
  } finally {
    isBusy.value = false
  }
}

async function mintNft() {
  if (!selectedPasskey.value || !safeAddress.value || !readiness.value.ready) return

  isBusy.value = true
  status.value = '正在请求 Passkey 签名并提交 UserOperation…'
  try {
    const userOperationHash = await mintPracticeNft(selectedPasskey.value, safeAddress.value, readiness.value)
    isDeployed.value = true
    status.value = `已提交 UserOperation：${userOperationHash}`
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Mint NFT 失败。'
  } finally {
    isBusy.value = false
  }
}

onMounted(() => {
  setRuntimeConfig()
  passkeys.value = loadPasskeys(localStorage)
})
</script>

<template>
  <main class="page-shell">
    <section class="hero">
      <p class="eyebrow">SAFE · ERC-4337 · ETHEREUM SEPOLIA</p>
      <h1>Safe Passkeys<br /><span>教程实践</span></h1>
      <p class="lead">按 Safe Nuxt 教程创建浏览器 Passkey、推导 Safe 地址，并在你明确点击后用 Pimlico 赞助的 UserOperation 部署 Safe 与 Mint NFT。</p>
    </section>

    <section class="wallet-panel" aria-label="Passkey 安全边界">
      <div>
        <p class="panel-label">安全边界</p>
        <strong>1/1 Passkey Safe 只用于本次教程练习</strong>
        <p>Passkey 绑定域名和设备；生产环境应加入恢复方式或其他 Owner，不能把单个 Passkey 当作唯一资产控制方式。</p>
      </div>
    </section>

    <section class="wallet-panel" aria-label="Passkey 操作区">
      <div>
        <p class="panel-label">步骤 1 · 浏览器 Passkey</p>
        <strong>{{ selectedPasskey ? '已选择一个 Passkey' : '尚未选择 Passkey' }}</strong>
        <p>Passkey 的公开坐标和 raw ID 仅存于当前浏览器 localStorage，私钥不会离开设备。</p>
      </div>
      <div class="wallet-actions">
        <button type="button" :disabled="isBusy" @click="createPasskey">{{ isBusy ? '处理中…' : '创建新的 Passkey' }}</button>
      </div>
    </section>

    <section v-if="passkeys.length" class="detail-panel" aria-label="已保存 Passkeys">
      <p class="panel-label">已保存 Passkeys</p>
      <button v-for="passkey in passkeys" :key="passkey.rawId" type="button" class="secondary" @click="choosePasskey(passkey)">
        使用 {{ passkey.rawId.slice(0, 12) }}…
      </button>
    </section>

    <section class="facts" aria-label="Safe 状态">
      <div><span>网络</span><strong>Ethereum Sepolia</strong></div>
      <div><span>Safe 地址</span><strong>{{ shortAddress || '创建 Passkey 后推导' }}</strong></div>
      <div><span>部署状态</span><strong>{{ safeAddress ? (isDeployed ? '已部署' : '等待首次交易部署') : '未就绪' }}</strong></div>
    </section>

    <section class="wallet-panel" aria-label="部署与 Mint">
      <div>
        <p class="panel-label">步骤 2 · 显式提交交易</p>
        <strong>Mint 教程 NFT</strong>
        <p>仅在你点击 Mint NFT 后才会请求签名并发送 UserOperation；这个动作会部署尚未部署的 Safe，并调用教程 NFT 合约。</p>
        <p v-if="!readiness.ready" class="wallet-error">{{ readiness.message }}</p>
      </div>
      <div class="wallet-actions">
        <button type="button" :disabled="!canMint" @click="mintNft">{{ isBusy ? '提交中…' : 'Mint NFT（会发送交易）' }}</button>
      </div>
    </section>

    <p v-if="status" class="wallet-panel" role="status">{{ status }}</p>
    <footer>练习基于 Safe 官方 Nuxt Passkeys 教程。Pimlico API key 为可见客户端配置，应在 Pimlico 控制台限制来源、预算和可赞助策略；不要提交 .env。</footer>
  </main>
</template>
