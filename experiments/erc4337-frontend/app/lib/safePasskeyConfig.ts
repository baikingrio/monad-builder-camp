import {
  getSafePasskeyNetworkProfile,
  type SafePasskeyNetworkId,
  type SafePasskeyNetworkProfile
} from './safePasskeyNetworks'
import {
  buildPimlicoV2RpcUrl,
  PIMLICO_MONAD_TESTNET_CHAIN,
  PIMLICO_SEPOLIA_CHAIN
} from './pimlicoEndpoints'

function parsePimlico403Hint(body: string): string {
  if (/chain.*not supported/i.test(body)) {
    return '请在 Dashboard 为该 Key 启用 Monad Testnet（monad-testnet）。'
  }
  if (/origin|referer|cors/i.test(body)) {
    return '请在 Allowed origins 加入 http://localhost:3000。'
  }
  return 'Dashboard → API Keys → 启用 Monad Testnet、Allowed origins、Sponsorship policy。'
}

export type SafePasskeyReadiness =
  | { ready: false; message: string; network: SafePasskeyNetworkProfile }
  | { ready: true; bundlerUrl: string; paymasterUrl: string; network: SafePasskeyNetworkProfile }

export type SafePasskeyRuntimeKeys = {
  pimlicoApiKey?: string
  monadPimlicoApiKey?: string
}

function resolvePimlicoKey(networkId: SafePasskeyNetworkId, keys: SafePasskeyRuntimeKeys): string | undefined {
  const trimmedSepolia = keys.pimlicoApiKey?.trim()
  const trimmedMonad = keys.monadPimlicoApiKey?.trim()
  if (networkId === 'monad') return trimmedMonad || trimmedSepolia
  return trimmedSepolia
}

export function getSafePasskeyReadiness(
  networkId: SafePasskeyNetworkId,
  keys: SafePasskeyRuntimeKeys | string | undefined
): SafePasskeyReadiness {
  const network = getSafePasskeyNetworkProfile(networkId)
  const keyBundle: SafePasskeyRuntimeKeys = typeof keys === 'string' ? { pimlicoApiKey: keys } : (keys ?? {})
  const apiKey = resolvePimlicoKey(networkId, keyBundle)

  if (!apiKey) {
    return {
      ready: false,
      network,
      message: `请先在 .env 设置 ${network.envKeyHint}，才可部署 Safe 或发送练习 UserOperation。`
    }
  }

  const endpoint =
    networkId === 'sepolia'
      ? buildPimlicoV2RpcUrl(PIMLICO_SEPOLIA_CHAIN, apiKey)
      : buildPimlicoV2RpcUrl(PIMLICO_MONAD_TESTNET_CHAIN, apiKey)

  return {
    ready: true,
    bundlerUrl: endpoint,
    paymasterUrl: endpoint,
    network
  }
}

/** 将 Pimlico / Bundler 常见错误转为可操作的提示 */
export function formatSafePasskeyError(error: unknown, networkId: SafePasskeyNetworkId = 'sepolia'): string {
  const raw = error instanceof Error ? error.message : String(error)
  const chainLabel = networkId === 'monad' ? 'Monad Testnet (10143)' : 'Ethereum Sepolia'
  if (/preVerificationGas is not enough|-32500/i.test(raw)) {
    return 'Bundler 认为 preVerificationGas 不足（Passkey 签名体积大、首笔 deploy 的 initCode 更重）。已提高估算缓冲；请重启 dev 后再提交。若仍失败，把新的 required/got 数值发出来。'
  }
  if (/403|Forbidden|deprecated.*v2/i.test(raw)) {
    return `Pimlico 403：多为 API Key 未勾选 Monad Testnet 或 Allowed origins 未含当前站点。${parsePimlico403Hint(raw)}`
  }
  if (/401|Unauthorized|invalid 'apikey'/i.test(raw)) {
    return 'Pimlico API Key 无效或未生效，请检查 .env 中的 Pimlico 相关变量并重启 dev。'
  }
  if (/CALL_EXCEPTION|execution reverted.*0x94a4F6affBd8975951142c3999aEAB7ecee555c2/i.test(raw)) {
    return 'Passkey 初始化误调用了 Shared Signer 上的 Factory 接口（getSigner）。请刷新并重试；若仍失败，确认 dev 已加载最新 Monad Passkey 补丁。'
  }
  if (/Invalid safeWebAuthnSignerFactory contract address/i.test(raw)) {
    return 'Protocol Kit 在 Monad 上找不到 Passkey SignerFactory 部署表项。请更新到包含 Monad contractNetworks 补丁的版本后再试；若仍失败，说明链上可能未部署 Factory。'
  }
  if (/safeWebAuthnSignerFactory contract is not deployed/i.test(raw)) {
    return 'Monad Testnet 上 canonical SafeWebAuthnSignerFactory 尚无合约代码；本练习已尝试用 Shared Signer 路径绕过，若仍出现此错误请反馈完整堆栈。'
  }
  if (/FCLP256Verifier address not found/i.test(raw)) {
    return 'Protocol Kit 在 Monad 上找不到 FCL P256 Verifier 地址；请确认已启用 Monad Passkey SDK 补丁。'
  }
  if (/safeWebAuthnSharedSignerAddress not available/i.test(raw)) {
    return '当前链缺少 Safe WebAuthn Shared Signer 部署地址；Monad 实验应已通过 customContracts 注入，若仍出现此错误请检查网络配置。'
  }
  if (/Safe4337Module and\/or AddModulesLib not available/i.test(raw)) {
    return `Safe 4337 模块或 AddModulesLib 在该链不可用；请确认 ${chainLabel} 的 customContracts 配置。`
  }
  if (/entrypoint.*not compatible with version 0\.2\.0 of Safe modules/i.test(raw)) {
    return 'Relay Kit v3 只支持 Safe Modules 0.2.0（EntryPoint v0.6）。Monad Passkeys 已改为 v0.6 栈；请重启 dev 后重试。'
  }
  return raw || '操作失败。'
}
