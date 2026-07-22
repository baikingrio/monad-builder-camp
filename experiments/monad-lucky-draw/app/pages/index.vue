<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { Address } from 'viem'
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
import WalletConnectionPanel from '../components/WalletConnectionPanel.vue'
import SafeStatusCard from '../components/SafeStatusCard.vue'
import DrawResultCard, { type DrawOutcome } from '../components/DrawResultCard.vue'

const demoState = ref(createDemoState())
const sponsorEnabled = ref(false)
const sessionEnabled = ref(false)
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

onMounted(() => { void refreshSponsorReadiness() })

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

  drawOutcome.value = { kind: 'pending', message: '正在生成 Session Key 并请求启用授权…' }
  try {
    const privateKey = generatePrivateKey()
    const account = privateKeyToAccount(privateKey)
    const prepared = await $fetch<{
      ok: boolean
      reason?: string
      grant?: { expiresAt: number; remainingCalls: number; sessionAddress: string }
      userOperation?: UnsignedSponsoredUserOperation
    }>('/api/draw/session-enable', {
      method: 'POST',
      body: { userClicked: true, safe, sessionAddress: account.address }
    })
    if (!prepared.ok || !prepared.userOperation || !prepared.grant) throw new Error(prepared.reason || 'Session 启用准备失败')

    drawOutcome.value = { kind: 'pending', message: '请在钱包中签署一次，将 Session Key 加入 Safe…' }
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

  drawOutcome.value = { kind: 'pending', message: '正在准备免弹窗抽卡（无钱包弹窗）…' }
  try {
    const prepared = await $fetch<{
      ok: boolean
      reason?: string
      userOperation?: UnsignedSponsoredUserOperation
    }>('/api/draw/session-draw', {
      method: 'POST',
      body: { userClicked: true, safe }
    })
    if (!prepared.ok || !prepared.userOperation) throw new Error(prepared.reason || '免弹窗抽卡准备失败')

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
      body: { safe, userOperation: { ...prepared.userOperation, signature } }
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
        <SafeStatusCard :state="demoState" @check-deployment-status="checkSafeDeploymentStatus" />
        <DrawResultCard
          :state="demoState"
          :first-draw-available="firstDrawAvailable"
          :activation-readiness="activationReadiness"
          :sponsor-enabled="sponsorEnabled"
          :session-enabled="sessionEnabled"
          :outcome="drawOutcome"
          @activate="activateAndDraw"
          @enable-session="enableSessionKey"
          @session-draw="sessionDraw"
        />
      </div>
    </section>

    <aside class="faucet-boundary" aria-labelledby="faucet-title">
      <h2 id="faucet-title">测试代币边界</h2>
      <p><strong>测试代币请使用 Monad 官方水龙头。</strong>本应用不提供水龙头、不保管私钥、不发送测试币。Gas 由 Pimlico Paymaster 在资格有效时赞助。</p>
    </aside>
  </main>
</template>

<style scoped>
:global(*) { box-sizing: border-box; }
:global(body) { margin: 0; background: #f8fafc; color: #111827; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.page-shell { width: min(1120px, calc(100% - 2rem)); margin: 0 auto; padding: 3rem 0; }.hero { max-width: 780px; }.network-badge { display: inline-block; margin: 0; padding: .35rem .7rem; border-radius: 999px; background: #ede9fe; color: #5b21b6; font-size: .82rem; font-weight: 800; }.hero h1 { margin: .8rem 0 .45rem; font-size: clamp(2rem, 5vw, 3.4rem); letter-spacing: -.04em; }.lead { margin: 0; color: #4b5563; font-size: 1.1rem; line-height: 1.65; }.security-boundary { margin-top: 1.4rem; padding: 1rem 1.1rem; border: 1px solid #c4b5fd; border-radius: .8rem; background: #faf5ff; color: #4c1d95; line-height: 1.6; }.journey { margin-top: 3rem; }.section-heading { margin-bottom: 1.15rem; }.eyebrow { margin: 0 0 .3rem; color: #6d28d9; font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }.section-heading h2, .faucet-boundary h2 { margin: 0; font-size: 1.35rem; }.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }.faucet-boundary { margin-top: 1.25rem; padding: 1.15rem 1.25rem; border-left: 4px solid #7c3aed; border-radius: .65rem; background: #fff; }.faucet-boundary p { margin: .5rem 0 0; color: #374151; line-height: 1.6; } @media (max-width: 820px) { .page-shell { padding: 2rem 0; }.cards { grid-template-columns: 1fr; } }
</style>
