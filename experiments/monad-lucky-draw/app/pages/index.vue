<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createWalletClient, defineChain, http, type Address } from 'viem'
import { createDemoState, isDrawAvailable, transitionDemoState } from '../lib/demoState'
import type { LoginSnapshot } from '../lib/eoaLogin'
import { evaluateActivationReadiness } from '../lib/activationReadiness'
import { MONAD_ACTIVATION_CONFIG } from '../lib/monadConfig'
import { deriveMonadCounterfactualSafe } from '../lib/safeAddress'
import { getMonadSafeDeploymentStatus } from '../lib/safeDeploymentStatus'
import { signActivationUserOperation } from '../lib/signActivationUserOperation'
import { signWithOwnerWallet, signWithSessionKey } from '../lib/signSessionUserOperation'
import { loadSessionKey, saveSessionKey } from '../lib/sessionKeyStorage'
import type { UnsignedSponsoredUserOperation } from '../lib/activationUserOperation'
import { createDepositRequest } from '../lib/entryPointDeposit'
import { createSafeNativeFundRequest } from '../lib/safeNativeFund'
import { defaultSafe7579StackStatus, evaluateSafe7579Readiness, type Safe7579Mode } from '../lib/safe7579Readiness'
import { defaultRolesStackStatus, evaluateRolesReadiness, type RolesSessionMode } from '../lib/rolesReadiness'
import WalletConnectionPanel from '../components/WalletConnectionPanel.vue'
import SafeStatusCard from '../components/SafeStatusCard.vue'
import DrawResultCard, { type DrawOutcome } from '../components/DrawResultCard.vue'
import { SESSION_KEY_GAS_TIP_WEI } from '../lib/rolesPermissions'

const demoState = ref(createDemoState())
const sponsorEnabled = ref(false)
const sessionEnabled = ref(false)
const sessionMode = ref<RolesSessionMode>('legacy-owner-session')
const sessionBlockers = ref<readonly string[]>(evaluateRolesReadiness(defaultRolesStackStatus()).blockers)
const archivedSafe7579Mode = ref<Safe7579Mode>('legacy-owner-session')
void archivedSafe7579Mode // archived 7579 readiness kept for cross-check only
const entryPointDeposit = ref('0')
const safeNativeBalance = ref('0')
const sessionFundingSufficient = computed(() => {
  try {
    return BigInt(entryPointDeposit.value) > 0n
  } catch {
    return false
  }
})
const safeAddressDisplay = computed(() => demoState.value.counterfactualSafeAddress || '')
const formatMon = (wei: string) => {
  try {
    const value = BigInt(wei)
    const whole = value / 10n ** 18n
    const frac = (value % 10n ** 18n).toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '')
    return frac ? `${whole}.${frac}` : whole.toString()
  } catch {
    return '0'
  }
}
const safeNativeMon = computed(() => formatMon(safeNativeBalance.value))
const entryPointDepositMon = computed(() => formatMon(entryPointDeposit.value))
const sessionTipMon = computed(() => formatMon(SESSION_KEY_GAS_TIP_WEI.toString()))
const tipFundingOk = computed(() => {
  try {
    return BigInt(safeNativeBalance.value) >= SESSION_KEY_GAS_TIP_WEI
  } catch {
    return false
  }
})
const depositAmount = ref('0.05')
const safeFundAmount = ref('0.1')
const depositRefreshing = ref(false)
const fundingBusy = ref(false)
const drawOutcome = ref<DrawOutcome>({ kind: 'idle' })
const activationReadiness = computed(() => evaluateActivationReadiness({
  config: MONAD_ACTIVATION_CONFIG,
  sponsorPolicy: { persistent: sponsorEnabled.value, authorized: sponsorEnabled.value },
  ownerAuthorization: demoState.value.authenticated && demoState.value.connectedEoa
    ? { owner: demoState.value.connectedEoa, signature: `0x${'ab'.repeat(65)}`, cryptographicallyVerified: true }
    : undefined,
  userClicked: drawOutcome.value.kind === 'pending' || drawOutcome.value.kind === 'preview' || drawOutcome.value.kind === 'success'
}))
const firstDrawAvailable = computed(() => isDrawAvailable(demoState.value) && activationReadiness.value.canConstructUserOperation)

function refreshLocalSession(eoa?: string, safe?: string) {
  if (!eoa || !safe) {
    sessionEnabled.value = false
    return
  }
  sessionEnabled.value = Boolean(loadSessionKey(eoa, safe))
}

async function refreshSponsorReadiness() {
  try {
    const response = await $fetch<{ enabled?: boolean }>('/api/draw/readiness')
    sponsorEnabled.value = response.enabled === true
    if (demoState.value.authenticated && demoState.value.safeDerivationVerified) {
      demoState.value = transitionDemoState(demoState.value, { type: 'sponsorReadinessChanged', ready: sponsorEnabled.value })
    }
  } catch {
    sponsorEnabled.value = false
  }
}

async function refreshRolesReadiness() {
  try {
    const response = await $fetch<{
      mode?: RolesSessionMode
      blockers?: string[]
    }>('/api/draw/roles-readiness')
    if (response.mode === 'legacy-owner-session' || response.mode === 'zodiac-roles-session') {
      sessionMode.value = response.mode
    }
    if (Array.isArray(response.blockers)) sessionBlockers.value = response.blockers
  } catch {
    const offline = evaluateRolesReadiness(defaultRolesStackStatus())
    sessionMode.value = offline.mode
    sessionBlockers.value = offline.blockers
  }
  try {
    const archived = await $fetch<{ mode?: Safe7579Mode }>('/api/draw/safe7579-readiness')
    if (archived.mode === 'legacy-owner-session' || archived.mode === 'safe7579-smart-session') {
      archivedSafe7579Mode.value = archived.mode
    }
  } catch {
    archivedSafe7579Mode.value = evaluateSafe7579Readiness(defaultSafe7579StackStatus()).mode
  }
}

onMounted(() => {
  void refreshSponsorReadiness()
  void refreshRolesReadiness()
})

async function refreshFunding() {
  if (!demoState.value.authenticated || !demoState.value.counterfactualSafeAddress) return
  depositRefreshing.value = true
  try {
    const response = await $fetch<{ ok: boolean; deposit?: string; nativeBalance?: string; safe?: string }>('/api/draw/funding')
    if (response.ok && /^\d+$/.test(response.deposit || '')) entryPointDeposit.value = response.deposit!
    if (response.ok && /^\d+$/.test(response.nativeBalance || '')) safeNativeBalance.value = response.nativeBalance!
  } finally {
    depositRefreshing.value = false
  }
}

async function waitForWalletTx(hash: unknown) {
  for (let attempt = 0; attempt < 45; attempt++) {
    const receipt = await ethereumProvider().request({ method: 'eth_getTransactionReceipt', params: [hash] }) as
      | { status?: string | number }
      | null
    if (receipt) {
      const status = receipt.status
      if (status === '0x0' || status === 0 || status === '0') {
        throw new Error('交易已上链但执行失败（可能 gas 不足或 reserve balance）')
      }
      return
    }
    await new Promise(resolve => setTimeout(resolve, 1_000))
  }
  throw new Error('等待交易确认超时，请稍后点「刷新余额」')
}

async function rechargeEntryPoint() {
  const safe = demoState.value.counterfactualSafeAddress
  if (!safe) return
  fundingBusy.value = true
  try {
    const request = createDepositRequest({ safe, amount: depositAmount.value })
    const hash = await ethereumProvider().request({
      method: 'eth_sendTransaction',
      params: [{
        from: demoState.value.connectedEoa,
        to: request.to,
        data: request.data,
        value: `0x${request.value.toString(16)}`
      }]
    })
    drawOutcome.value = { kind: 'pending', message: '正在等待 EntryPoint 充值交易确认…' }
    await waitForWalletTx(hash)
    await refreshFunding()
    drawOutcome.value = { kind: 'idle' }
  } catch (error) {
    drawOutcome.value = { kind: 'error', message: error instanceof Error ? error.message : 'EntryPoint 充值失败' }
  } finally {
    fundingBusy.value = false
  }
}

async function fundSafeNative() {
  const safe = demoState.value.counterfactualSafeAddress
  if (!safe) return
  fundingBusy.value = true
  try {
    const request = createSafeNativeFundRequest({ safe, amount: safeFundAmount.value })
    const hash = await ethereumProvider().request({
      method: 'eth_sendTransaction',
      params: [{
        from: demoState.value.connectedEoa,
        to: request.to,
        data: request.data,
        value: `0x${request.value.toString(16)}`
      }]
    })
    drawOutcome.value = { kind: 'pending', message: `正在等待向 Safe 转入 ${safeFundAmount.value} MON…` }
    await waitForWalletTx(hash)
    await refreshFunding()
    drawOutcome.value = { kind: 'idle' }
  } catch (error) {
    drawOutcome.value = { kind: 'error', message: error instanceof Error ? error.message : 'Safe 原生充值失败' }
  } finally {
    fundingBusy.value = false
  }
}

function syncLogin(snapshot: LoginSnapshot) {
  if (!snapshot.authenticated || !snapshot.account || snapshot.chainId !== 10143) {
    demoState.value = createDemoState()
    drawOutcome.value = { kind: 'idle' }
    sessionEnabled.value = false
    return
  }
  let next = transitionDemoState(createDemoState(), { type: 'walletConnected', eoa: snapshot.account })
  next = transitionDemoState(next, { type: 'monadTestnetChanged', ready: true })
  next = transitionDemoState(next, { type: 'authenticated' })
  const safe = deriveMonadCounterfactualSafe({ owner: snapshot.account, config: MONAD_ACTIVATION_CONFIG, saltNonce: 0n })
  next = transitionDemoState(next, { type: 'safeDerivationVerified', address: safe.address })
  if (sponsorEnabled.value) next = transitionDemoState(next, { type: 'sponsorReadinessChanged', ready: true })
  demoState.value = next
  refreshLocalSession(snapshot.account, safe.address)
  void refreshFunding()
}

async function checkSafeDeploymentStatus() {
  const stateAtClick = demoState.value
  const address = stateAtClick.counterfactualSafeAddress
  if (!stateAtClick.authenticated || !stateAtClick.safeDerivationVerified || !address) return

  const result = await getMonadSafeDeploymentStatus(address)
  if (demoState.value.counterfactualSafeAddress !== address || !demoState.value.authenticated) return
  demoState.value = transitionDemoState(demoState.value, { type: 'safeDeploymentStatusChecked', status: result.kind })
}

function ethereumProvider() {
  const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum
  if (!ethereum) throw new Error('未找到浏览器钱包')
  return ethereum
}

async function activateAndDraw() {
  const state = demoState.value
  const owner = state.connectedEoa
  const safeAddress = state.counterfactualSafeAddress
  if (!owner || !safeAddress || state.safeDeploymentStatus !== 'not-deployed') return

  drawOutcome.value = { kind: 'pending', message: '正在请求服务端赞助准备…' }
  try { demoState.value = transitionDemoState(demoState.value, { type: 'activationStarted' }) } catch { /* continue */ }

  try {
    const activated = await $fetch<{
      ok: boolean
      reason?: string
      claimId?: string
      safe?: string
      entryPoint?: string
      userOperation?: UnsignedSponsoredUserOperation
    }>('/api/draw/activate', {
      method: 'POST',
      body: {
        userClicked: true,
        safe: {
          address: safeAddress,
          owner,
          derivationVerified: true,
          deploymentStatus: 'not-deployed',
          safeDeployed: false
        }
      }
    })
    if (!activated.ok || !activated.userOperation || !activated.claimId || !activated.safe) {
      throw new Error(activated.reason || '赞助准备失败')
    }

    drawOutcome.value = { kind: 'pending', message: '请在钱包中签署 Owner UserOperation（链上 AA 授权）…' }
    const signature = await signActivationUserOperation({
      owner: owner as Address,
      ethereum: ethereumProvider(),
      userOperation: activated.userOperation
    })

    drawOutcome.value = { kind: 'pending', message: '正在提交 UserOperation 并等待链上确认…' }
    const submitted = await $fetch<{
      ok: boolean
      reason?: string
      userOpHash?: string
      txHash?: string
      safe?: string
      txUrl?: string
    }>('/api/draw/submit', {
      method: 'POST',
      body: {
        claimId: activated.claimId,
        safe: activated.safe,
        userOperation: { ...activated.userOperation, signature }
      }
    })
    if (!submitted.ok || !submitted.userOpHash) throw new Error(submitted.reason || 'UserOperation 提交失败')

    drawOutcome.value = {
      kind: 'success',
      userOpHash: submitted.userOpHash,
      txHash: submitted.txHash,
      safe: submitted.safe || activated.safe,
      txUrl: submitted.txUrl
    }
    try {
      demoState.value = transitionDemoState(demoState.value, { type: 'activationSucceeded' })
    } catch {
      demoState.value = { ...demoState.value, status: 'active', safeDeployed: true }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '激活失败'
    drawOutcome.value = { kind: 'error', message }
    try {
      if (demoState.value.status === 'activationPending') {
        demoState.value = transitionDemoState(demoState.value, { type: 'activationFailed', error: message })
      }
    } catch { /* keep error */ }
  }
}

async function enableSessionKey() {
  const owner = demoState.value.connectedEoa
  const safe = demoState.value.counterfactualSafeAddress
  if (!owner || !safe) return

  const rolesMode = MONAD_ACTIVATION_CONFIG.rolesSessionEnabled === true
  drawOutcome.value = {
    kind: 'pending',
    message: rolesMode
      ? '正在生成 Session Key（Roles：需 Safe 原生 MON tip + EntryPoint Deposit）…'
      : '正在生成 Session Key（Gas 由 EntryPoint Deposit 支付）…'
  }
  try {
    const privateKey = generatePrivateKey()
    const account = privateKeyToAccount(privateKey)
    const prepared = await $fetch<{
      ok: boolean
      reason?: string
      neededWei?: string
      balanceWei?: string
      mode?: string
      rolesModifier?: string
      grant?: { expiresAt: number; remainingCalls: number; sessionAddress: string }
      userOperation?: UnsignedSponsoredUserOperation
    }>('/api/draw/session-enable', {
      method: 'POST',
      body: { userClicked: true, safe, sessionAddress: account.address }
    })
    if (!prepared.ok || !prepared.userOperation || !prepared.grant) {
      if (prepared.reason === 'safe-native-balance-insufficient-for-session-tip') {
        const needMon = Number(BigInt(prepared.neededWei || '0')) / 1e18
        const haveMon = Number(BigInt(prepared.balanceWei || '0')) / 1e18
        throw new Error(
          `Safe 原生 MON 不足 Session tip：需要 ≥ ${needMon} MON，当前 ${haveMon} MON。请用 Owner 钱包向 Safe（${safe}）转入至少 ${(needMon - haveMon).toFixed(3)} MON 后再启用。`
        )
      }
      throw new Error(prepared.reason || 'Session 启用准备失败')
    }

    drawOutcome.value = {
      kind: 'pending',
      message: rolesMode
        ? '请在钱包中签署一次 Owner UserOp（安装 Roles + 赋权 Session Key）…'
        : '请在钱包中签署一次，将 Session Key 加入 Safe…'
    }
    const signature = await signWithOwnerWallet({
      owner: owner as Address,
      ethereum: ethereumProvider(),
      safe: safe as Address,
      userOperation: prepared.userOperation
    })

    drawOutcome.value = { kind: 'pending', message: '正在提交 Session 启用 UserOperation…' }
    const submitted = await $fetch<{ ok: boolean; reason?: string; txUrl?: string }>('/api/draw/session-enable-submit', {
      method: 'POST',
      body: {
        safe,
        sessionAddress: account.address,
        userOperation: { ...prepared.userOperation, signature }
      }
    })
    if (!submitted.ok) throw new Error(submitted.reason || 'Session 启用提交失败')

    saveSessionKey({
      eoa: owner,
      safe,
      address: account.address,
      privateKey,
      expiresAt: prepared.grant.expiresAt
    })
    sessionEnabled.value = true
    drawOutcome.value = {
      kind: 'session-ready',
      sessionAddress: prepared.grant.sessionAddress,
      remainingCalls: prepared.grant.remainingCalls,
      expiresAt: prepared.grant.expiresAt
    }
  } catch (error) {
    drawOutcome.value = { kind: 'error', message: error instanceof Error ? error.message : '启用免弹窗失败' }
  }
}

async function sessionDraw() {
  const owner = demoState.value.connectedEoa
  const safe = demoState.value.counterfactualSafeAddress
  if (!owner || !safe) return
  const stored = loadSessionKey(owner, safe)
  if (!stored) {
    sessionEnabled.value = false
    drawOutcome.value = { kind: 'error', message: '本地 Session Key 不存在或已过期，请重新启用' }
    return
  }

  if (MONAD_ACTIVATION_CONFIG.rolesSessionEnabled === true) {
    drawOutcome.value = { kind: 'pending', message: '正在准备 Roles 免弹窗抽卡（Session Key 自付 Gas）…' }
    try {
      const prepared = await $fetch<{
        ok: boolean
        reason?: string
        preparationId?: string
        transaction?: { to: string; value: string; data: string }
        sessionBalanceWei?: string
        estimatedGasTipFloorWei?: string
      }>('/api/draw/session-draw-prepare', {
        method: 'POST',
        body: { userClicked: true, safe }
      })
      if (!prepared.ok || !prepared.preparationId || !prepared.transaction) {
        if (
          prepared.reason === 'legacy-grant-requires-roles-reenable'
          || prepared.reason === 'grant-not-roles-mode'
        ) {
          sessionEnabled.value = false
          throw new Error('当前 Session 仍是 legacy（Session Key 为 Safe owner）。请重新点击「启用免弹窗抽奖」，安装 Zodiac Roles 后再抽。')
        }
        throw new Error(prepared.reason || 'Roles 抽卡准备失败')
      }
      if (
        prepared.sessionBalanceWei
        && prepared.estimatedGasTipFloorWei
        && BigInt(prepared.sessionBalanceWei) < BigInt(prepared.estimatedGasTipFloorWei)
      ) {
        throw new Error(`Session Key 还差 MON 付 Gas（余额 ${prepared.sessionBalanceWei} wei）`)
      }

      const account = privateKeyToAccount(stored.privateKey as `0x${string}`)
      const chain = defineChain({
        id: 10143,
        name: 'Monad Testnet',
        nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
        rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } }
      })
      const wallet = createWalletClient({ account, chain, transport: http('https://testnet-rpc.monad.xyz') })
      drawOutcome.value = { kind: 'pending', message: 'Session Key 本地签名并广播 Roles.execTransactionWithRole…' }
      const txHash = await wallet.sendTransaction({
        to: prepared.transaction.to as Address,
        value: BigInt(prepared.transaction.value),
        data: prepared.transaction.data as `0x${string}`
      })

      const confirmed = await $fetch<{
        ok: boolean
        reason?: string
        txHash?: string
        txUrl?: string
        remainingCalls?: number
      }>('/api/draw/session-draw-confirm', {
        method: 'POST',
        body: { preparationId: prepared.preparationId, txHash, safe }
      })
      if (!confirmed.ok) throw new Error(confirmed.reason || 'Roles 抽卡确认失败')

      drawOutcome.value = {
        kind: 'session-draw-success',
        userOpHash: txHash,
        txHash: confirmed.txHash ?? txHash,
        txUrl: confirmed.txUrl,
        remainingCalls: confirmed.remainingCalls ?? 0
      }
      // Roles self-paid: no call cap; keep session enabled until TTL.
    } catch (error) {
      drawOutcome.value = { kind: 'error', message: error instanceof Error ? error.message : '免弹窗抽卡失败' }
    }
    return
  }

  drawOutcome.value = { kind: 'pending', message: '正在准备用户充值支付 Gas 的免弹窗抽卡…' }
  try {
    const prepared = await $fetch<{
      ok: boolean
      reason?: string
      preparationId?: string
      userOperation?: UnsignedSponsoredUserOperation
    }>('/api/draw/session-draw', {
      method: 'POST',
      body: { userClicked: true, safe }
    })
    if (!prepared.ok || !prepared.userOperation || !prepared.preparationId) throw new Error(prepared.reason || '免弹窗抽卡准备失败')

    const signature = await signWithSessionKey({
      privateKey: stored.privateKey,
      safe: safe as Address,
      userOperation: prepared.userOperation
    })

    drawOutcome.value = { kind: 'pending', message: '正在提交免弹窗 UserOperation…' }
    const submitted = await $fetch<{
      ok: boolean
      reason?: string
      userOpHash?: string
      txHash?: string
      txUrl?: string
      remainingCalls?: number
    }>('/api/draw/session-draw-submit', {
      method: 'POST',
      body: { preparationId: prepared.preparationId, signature, safe }
    })
    if (!submitted.ok || !submitted.userOpHash) throw new Error(submitted.reason || '免弹窗抽卡提交失败')

    drawOutcome.value = {
      kind: 'session-draw-success',
      userOpHash: submitted.userOpHash,
      txHash: submitted.txHash,
      txUrl: submitted.txUrl,
      remainingCalls: submitted.remainingCalls ?? 0
    }
    if ((submitted.remainingCalls ?? 0) <= 0) sessionEnabled.value = false
  } catch (error) {
    drawOutcome.value = { kind: 'error', message: error instanceof Error ? error.message : '免弹窗抽卡失败' }
  }
}
</script>

<template>
  <main class="page-shell">
    <header class="hero" aria-labelledby="page-title">
      <p class="network-badge">Monad Testnet</p>
      <h1 id="page-title">Monad Lucky Draw</h1>
      <p class="lead">EOA 绑定、反事实 Safe、Pimlico 赞助首次抽卡，以及受限 Session Key 免弹窗再抽。</p>
      <div class="security-boundary" role="note" aria-label="安全边界">
        <strong>安全边界：</strong>仅限测试网，不涉及真实资产。仅在点击相关按钮后才会请求登录签名或链上授权。免弹窗需一次 Owner 授权启用 Session Key；之后由本地 Session Key 签名，服务端仍只允许固定 draw()。
      </div>
    </header>

    <section class="journey" aria-labelledby="journey-title">
      <div class="section-heading">
        <p class="eyebrow">预期旅程</p>
        <h2 id="journey-title">先激活，再启用免弹窗</h2>
      </div>
      <div class="cards">
        <WalletConnectionPanel :state="demoState" @login-state="syncLogin" />
        <SafeStatusCard
          :state="demoState"
          :native-balance-wei="safeNativeBalance"
          :entry-point-deposit-wei="entryPointDeposit"
          :session-tip-wei="SESSION_KEY_GAS_TIP_WEI.toString()"
          :funding-refreshing="depositRefreshing"
          @check-deployment-status="checkSafeDeploymentStatus"
          @refresh-funding="refreshFunding"
        />
        <DrawResultCard
          :state="demoState"
          :first-draw-available="firstDrawAvailable"
          :activation-readiness="activationReadiness"
          :sponsor-enabled="sponsorEnabled"
          :session-enabled="sessionEnabled"
          :entry-point-deposit="entryPointDeposit"
          :session-funding-sufficient="sessionFundingSufficient"
          :session-mode="sessionMode"
          :session-blockers="sessionBlockers"
          :outcome="drawOutcome"
          @activate="activateAndDraw"
          @enable-session="enableSessionKey"
          @session-draw="sessionDraw"
        />
      </div>
    </section>

    <section class="faucet-boundary" aria-labelledby="deposit-title">
      <h2 id="deposit-title">Safe 资金（地址 / 余额）</h2>
      <dl class="funding-stats" v-if="safeAddressDisplay">
        <div>
          <dt>Safe 地址</dt>
          <dd>
            <code>{{ safeAddressDisplay }}</code>
            <a :href="`https://testnet.monadvision.com/address/${safeAddressDisplay}`" target="_blank" rel="noopener noreferrer">Explorer</a>
          </dd>
        </div>
        <div>
          <dt>Safe 原生余额</dt>
          <dd>
            <strong>{{ safeNativeMon }} MON</strong>
            <span class="muted">（{{ safeNativeBalance }} wei）</span>
            <span v-if="sessionMode === 'zodiac-roles-session'" :class="tipFundingOk ? 'ok' : 'warn'">
              Roles tip 需 ≥ {{ sessionTipMon }} MON
            </span>
          </dd>
        </div>
        <div>
          <dt>EntryPoint Deposit</dt>
          <dd>
            <strong>{{ entryPointDepositMon }} MON</strong>
            <span class="muted">（{{ entryPointDeposit }} wei）</span>
          </dd>
        </div>
      </dl>
      <p v-else>登录并派生 Safe 后将显示地址与余额。</p>
      <p>Roles tip 需要 Safe <strong>原生 MON</strong>；启用 UserOp 的 Gas 需要 EntryPoint Deposit。两者都由你的 EOA 钱包直接转出，应用不托管资金。若 Owner 为 EIP-7702 委托账户，请保持余额 ≥ 10 MON（Monad reserve）。</p>
      <div class="fund-actions">
        <label>
          Safe 原生 MON
          <input v-model="safeFundAmount" inputmode="decimal" aria-label="Safe 原生充值金额">
        </label>
        <button type="button" :disabled="!demoState.authenticated || fundingBusy || depositRefreshing" @click="fundSafeNative">充值到 Safe</button>
      </div>
      <div class="fund-actions">
        <label>
          EntryPoint Deposit MON
          <input v-model="depositAmount" inputmode="decimal" aria-label="EntryPoint 充值金额">
        </label>
        <button type="button" :disabled="!demoState.authenticated || fundingBusy || depositRefreshing" @click="rechargeEntryPoint">充值到 EntryPoint</button>
      </div>
      <button type="button" :disabled="!demoState.authenticated || fundingBusy || depositRefreshing" @click="refreshFunding">刷新余额</button>
    </section>

    <aside class="faucet-boundary" aria-labelledby="faucet-title">
      <h2 id="faucet-title">测试代币边界</h2>
      <p><strong>测试代币请使用 Monad 官方水龙头。</strong>本应用不提供水龙头、不保管私钥。可在上方把 EOA 里的测试 MON 转入当前 Safe（原生）或 EntryPoint Deposit。</p>
    </aside>
  </main>
</template>

<style scoped>
:global(*) { box-sizing: border-box; }
:global(body) { margin: 0; background: #f8fafc; color: #111827; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.page-shell { width: min(1120px, calc(100% - 2rem)); margin: 0 auto; padding: 3rem 0; }.hero { max-width: 780px; }.network-badge { display: inline-block; margin: 0; padding: .35rem .7rem; border-radius: 999px; background: #ede9fe; color: #5b21b6; font-size: .82rem; font-weight: 800; }.hero h1 { margin: .8rem 0 .45rem; font-size: clamp(2rem, 5vw, 3.4rem); letter-spacing: -.04em; }.lead { margin: 0; color: #4b5563; font-size: 1.1rem; line-height: 1.65; }.security-boundary { margin-top: 1.4rem; padding: 1rem 1.1rem; border: 1px solid #c4b5fd; border-radius: .8rem; background: #faf5ff; color: #4c1d95; line-height: 1.6; }.journey { margin-top: 3rem; }.section-heading { margin-bottom: 1.15rem; }.eyebrow { margin: 0 0 .3rem; color: #6d28d9; font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }.section-heading h2, .faucet-boundary h2 { margin: 0; font-size: 1.35rem; }.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }.faucet-boundary { margin-top: 1.25rem; padding: 1.15rem 1.25rem; border-left: 4px solid #7c3aed; border-radius: .65rem; background: #fff; }.faucet-boundary p { margin: .5rem 0 0; color: #374151; line-height: 1.6; }.funding-stats { margin: .75rem 0 0; display: grid; gap: .75rem; }.funding-stats > div { padding: .75rem .85rem; border-radius: .55rem; background: #f8fafc; border: 1px solid #e5e7eb; }.funding-stats dt { margin: 0; font-size: .78rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #6b7280; }.funding-stats dd { margin: .35rem 0 0; color: #111827; line-height: 1.5; }.funding-stats code { display: block; overflow-wrap: anywhere; font-size: .92rem; }.funding-stats a { display: inline-block; margin-top: .35rem; color: #5b21b6; font-weight: 700; }.funding-stats .muted { color: #6b7280; font-size: .85rem; margin-left: .35rem; }.funding-stats .ok { display: inline-block; margin-left: .5rem; color: #065f46; font-size: .85rem; font-weight: 700; }.funding-stats .warn { display: inline-block; margin-left: .5rem; color: #9a3412; font-size: .85rem; font-weight: 700; }.fund-actions { display: flex; flex-wrap: wrap; gap: .65rem; align-items: end; margin-top: .85rem; }.fund-actions label { display: grid; gap: .3rem; font-size: .85rem; font-weight: 700; color: #374151; }.fund-actions input { min-width: 8rem; padding: .45rem .55rem; border: 1px solid #d1d5db; border-radius: .45rem; font: inherit; }.fund-actions button, .faucet-boundary > button { padding: .55rem .85rem; border: 0; border-radius: .5rem; background: #6d28d9; color: #fff; font-weight: 700; cursor: pointer; }.fund-actions button:disabled, .faucet-boundary > button:disabled { background: #9ca3af; cursor: not-allowed; } @media (max-width: 820px) { .page-shell { padding: 2rem 0; }.cards { grid-template-columns: 1fr; } }
</style>
