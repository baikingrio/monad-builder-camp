# Safe Passkeys / Nuxt 实践

入口：

- Sepolia（官方教程链）：`/safe-passkeys`
- Monad Testnet（实验迁移）：`/safe-passkeys?network=monad`

本练习按 [Safe 官方 Nuxt Passkeys 教程](https://docs.safe.global/advanced/passkeys/tutorials/nuxt) 实现了以下流程：

1. 通过 WebAuthn 在 Chrome / Chromium 创建 Passkey。
2. 将 Safe SDK 所需的 `rawId` 和公钥坐标保存到当前浏览器的 `localStorage`；不会保存或导出私钥。
3. 使用 Safe Relay Kit 推导 counterfactual Safe 地址（Sepolia 或 Monad）。
4. 仅在用户明确点击练习按钮后才请求 Passkey 签名、提交 sponsored UserOperation，并在首笔交易时部署 Safe。

| 网络 | 练习交易 | Pimlico 环境变量 |
| --- | --- | --- |
| Sepolia | 教程 NFT `safeMint` | `NUXT_PUBLIC_PIMLICO_API_KEY` |
| Monad Testnet | 已部署 `EIP7702CheckInTarget.checkIn()` | `NUXT_PUBLIC_MONAD_PIMLICO_API_KEY`（可复用 Sepolia key） |

## Monad 实验说明

- Monad 文档**未**将 Safe Passkeys 列为与 Sepolia 同级的官方支持路径。本页使用 **Relay Kit v3 可用的 EntryPoint v0.6 + Safe4337 Module v0.2.0**（`/safe-4337-monad` 只读页仍引用文档中的 v0.7 模块地址），并注入 `AddModulesLib` 与 `SafeWebAuthnSharedSigner`。
- 标准 Safe + ERC-4337 在 Monad 上可参考 `/safe-4337-monad`；Passkey 全流程需在 Pimlico 启用 **Monad Testnet** 赞助策略后自行验证。

## 本地运行

```bash
cd experiments/erc4337-frontend
cp .env.example .env # 若不存在则手动新建 .env
# Sepolia: NUXT_PUBLIC_PIMLICO_API_KEY=
# Monad:   NUXT_PUBLIC_MONAD_PIMLICO_API_KEY=（或与 Sepolia 相同 key）
npm install
npm run dev
```

在 Chrome / Chromium 打开 `http://localhost:3000/safe-passkeys` 或带 `?network=monad`。Firefox 存在已知 Passkey 兼容性问题，不作为本练习的目标浏览器。

## 验证

```bash
npm test
npm run build
```

## 安全边界

- `.env` 不可提交；Pimlico key 应配置来源、预算和可赞助策略限制。
- 教程中的 **1/1 Passkey Safe** 只适用于学习。Passkey 可能因域名、设备迁移或厂商策略而不可用；生产环境需要额外 Owner 和恢复流程。
- “创建 Passkey”不会发送链上交易；只有练习按钮会产生实际 UserOperation。

## Pimlico 403 / Bundler 报错

Bundler / Paymaster 均使用 **v2**（v1 已弃用会 403）：

```text
# Sepolia
https://api.pimlico.io/v2/11155111/rpc?add_balance_override&apikey=YOUR_KEY

# Monad Testnet
https://api.pimlico.io/v2/monad-testnet/rpc?add_balance_override&apikey=YOUR_KEY
```

Sepolia 注意 `add_balance_override` 是**无等号**的 query flag，写成 `add_balance_override=` 可能导致 **403 Forbidden**。

若仍 403，在 [Pimlico Dashboard](https://dashboard.pimlico.io) 检查：

1. API Key 已启用对应链（Sepolia / Monad Testnet）
2. Allowed origins 包含 `http://localhost:3000`（或你实际访问的域名）
3. 已开启 **Verifying Paymaster / Sponsorship**

修改 `.env` 或 Dashboard 后需重启 `npm run dev`。
