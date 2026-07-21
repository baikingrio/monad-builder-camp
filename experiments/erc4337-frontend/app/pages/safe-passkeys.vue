<script setup lang="ts">
import type { PasskeyArgType } from '@safe-global/protocol-kit'
import { computed, onMounted, ref, watch } from 'vue'
import { loadPasskeys, savePasskey } from '../lib/passkeys'
import { createBrowserPasskey, getSafeAccountInfo, submitPracticeUserOperation } from '../lib/safePasskeyActions'
import { formatSafePasskeyError, getSafePasskeyReadiness } from '../lib/safePasskeyConfig'
import { formatPimlicoProbeFailure, probePimlicoRpc } from '../lib/pimlicoEndpoints'
import { parseSafePasskeyNetworkId, type SafePasskeyNetworkId } from '../lib/safePasskeyNetworks'

const route = useRoute()
const router = useRouter()

const passkeys = ref<PasskeyArgType[]>([])
const selectedPasskey = ref<PasskeyArgType | null>(null)
const safeAddress = ref('')
const isDeployed = ref(false)
const isBusy = ref(false)
const status = ref('')

const runtimeConfig = useRuntimeConfig()
const pimlicoApiKey = computed(() => String(runtimeConfig.public.pimlicoApiKey ?? ''))
const monadPimlicoApiKey = computed(() => String(runtimeConfig.public.monadPimlicoApiKey ?? ''))

const networkId = computed<SafePasskeyNetworkId>(() =>
  parseSafePasskeyNetworkId(route.query.network)
)

const readiness = computed(() =>
  getSafePasskeyReadiness(networkId.value, {
    pimlicoApiKey: pimlicoApiKey.value,
    monadPimlicoApiKey: monadPimlicoApiKey.value
  })
)

const canSubmitPractice = computed(() =>
  selectedPasskey.value !== null && safeAddress.value !== '' && readiness.value.ready && !isBusy.value
)

const practiceButtonLabel = computed(() =>
  networkId.value === 'monad' ? 'Check-in（会发送交易）' : 'Mint NFT（会发送交易）'
)

const mintDisabledReason = computed(() => {
  if (isBusy.value) return '正在处理上一笔操作…'
  if (!readiness.value.ready) return readiness.value.message
  if (!selectedPasskey.value) return '请先创建或选择一个 Passkey。'
  if (!safeAddress.value) return 'Safe 地址尚未就绪：请重新点击已保存的 Passkey，或查看下方状态信息。'
  return ''
})

const shortAddress = computed(() =>
  safeAddress.value ? `${safeAddress.value.slice(0, 6)}…${safeAddress.value.slice(-4)}` : ''
)

const heroEyebrow = computed(() =>
  networkId.value === 'monad'
    ? 'SAFE · ERC-4337 · MONAD TESTNET · 实验'
    : 'SAFE · ERC-4337 · ETHEREUM SEPOLIA'
)

function switchNetwork(id: SafePasskeyNetworkId) {
  if (id === networkId.value) return
  router.replace({ query: { ...route.query, network: id === 'monad' ? 'monad' : undefined } })
}

async function ensurePimlicoReachable(): Promise<boolean> {
  if (!readiness.value.ready) return false
  const probe = await probePimlicoRpc(readiness.value.bundlerUrl)
  if (!probe.ok) {
    status.value = formatPimlicoProbeFailure(probe)
    return false
  }
  return true
}

async function refreshSafeInfo(passkey: PasskeyArgType) {
  if (!readiness.value.ready) {
    status.value = readiness.value.message
    return
  }
  if (!(await ensurePimlicoReachable())) return
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
    status.value = formatSafePasskeyError(error, networkId.value)
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
    status.value = formatSafePasskeyError(error, networkId.value)
  } finally {
    isBusy.value = false
  }
}

async function submitPractice() {
  if (!selectedPasskey.value || !safeAddress.value || !readiness.value.ready) return

  isBusy.value = true
  status.value = '正在请求 Passkey 签名并提交 UserOperation…'
  try {
    if (!(await ensurePimlicoReachable())) return
    const userOperationHash = await submitPracticeUserOperation(
      selectedPasskey.value,
      safeAddress.value,
      readiness.value
    )
    isDeployed.value = true
    status.value = `已提交 UserOperation：${userOperationHash}`
  } catch (error) {
    status.value = formatSafePasskeyError(error, networkId.value)
  } finally {
    isBusy.value = false
  }
}

watch(networkId, () => {
  safeAddress.value = ''
  isDeployed.value = false
  status.value = ''
  const first = passkeys.value[0]
  if (first && readiness.value.ready) {
    void choosePasskey(first)
  }
})

onMounted(async () => {
  passkeys.value = loadPasskeys(localStorage)
  const first = passkeys.value[0]
  if (!first || !readiness.value.ready) return

  selectedPasskey.value = first
  isBusy.value = true
  try {
    await refreshSafeInfo(first)
  } catch (error) {
    status.value = formatSafePasskeyError(error, networkId.value)
  } finally {
    isBusy.value = false
  }
})
</script>

<template>
  <main class="page-shell">
    <section class="hero">
      <p class="eyebrow">{{ heroEyebrow }}</p>
      <h1>Safe Passkeys<br /><span>教程实践</span></h1>
      <p class="lead">
        按 Safe Nuxt 教程创建浏览器 Passkey、推导 Safe 地址，并在你明确点击后用 Pimlico 赞助的 UserOperation 部署 Safe 与发送练习交易。
        Sepolia 为官方教程链；Monad 为实验迁移（<code>?network=monad</code>）。
      </p>
    </section>

    <section class="wallet-panel" aria-label="网络选择">
      <div>
        <p class="panel-label">网络</p>
        <strong>{{ readiness.network.label }}</strong>
        <p v-if="readiness.network.experimentalNote">{{ readiness.network.experimentalNote }}</p>
      </div>
      <div class="wallet-actions">
        <button type="button" class="secondary" :disabled="networkId === 'sepolia'" @click="switchNetwork('sepolia')">Sepolia</button>
        <button type="button" class="secondary" :disabled="networkId === 'monad'" @click="switchNetwork('monad')">Monad Testnet</button>
      </div>
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
      <div><span>网络</span><strong>{{ readiness.network.label }}</strong></div>
      <div><span>Safe 地址</span><strong>{{ shortAddress || '创建 Passkey 后推导' }}</strong></div>
      <div><span>部署状态</span><strong>{{ safeAddress ? (isDeployed ? '已部署' : '等待首次交易部署') : '未就绪' }}</strong></div>
    </section>

    <section class="wallet-panel" aria-label="部署与练习交易">
      <div>
        <p class="panel-label">步骤 2 · 显式提交交易</p>
        <strong>{{ readiness.network.practiceTargetLabel }}</strong>
        <p>
          仅在你点击「{{ practiceButtonLabel }}」后才会请求签名并发送 UserOperation；首笔交易会部署尚未部署的 Safe，并调用
          <code>{{ readiness.network.practiceTargetAddress }}</code>。
        </p>
        <p v-if="!readiness.ready" class="wallet-error">{{ readiness.message }}</p>
        <p v-else-if="mintDisabledReason && !canSubmitPractice" class="wallet-error">{{ mintDisabledReason }}</p>
      </div>
      <div class="wallet-actions">
        <button type="button" :disabled="!canSubmitPractice" @click="submitPractice">{{ isBusy ? '提交中…' : practiceButtonLabel }}</button>
      </div>
    </section>

    <p v-if="status" class="wallet-panel" role="status">{{ status }}</p>
    <footer>Pimlico API key 为可见客户端配置，应在 Pimlico 控制台限制来源、预算和可赞助策略；不要提交 .env。</footer>
  </main>
</template>
