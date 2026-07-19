# Safe Passkeys / Nuxt 实践

入口：`/safe-passkeys`

本练习按 [Safe 官方 Nuxt Passkeys 教程](https://docs.safe.global/advanced/passkeys/tutorials/nuxt) 实现了以下流程：

1. 通过 WebAuthn 在 Chrome / Chromium 创建 Passkey。
2. 将 Safe SDK 所需的 `rawId` 和公钥坐标保存到当前浏览器的 `localStorage`；不会保存或导出私钥。
3. 使用 Safe Relay Kit 推导 Ethereum Sepolia 上的 counterfactual Safe 地址。
4. 仅在用户明确点击 **Mint NFT（会发送交易）** 后才请求 Passkey 签名、提交 sponsored UserOperation，并在首笔交易时部署 Safe。

## 本地运行

```bash
cd experiments/erc4337-frontend
cp .env.example .env # 若不存在则手动新建 .env
# 设置 NUXT_PUBLIC_PIMLICO_API_KEY=你的受限 Pimlico API key
npm install
npm run dev
```

在 Chrome / Chromium 打开 `http://localhost:3000/safe-passkeys`。Firefox 存在已知 Passkey 兼容性问题，不作为本练习的目标浏览器。

## 验证

```bash
npm test
npm run build
```

## 安全边界

- `.env` 不可提交；Pimlico key 应配置来源、预算和可赞助策略限制。
- 教程中的 **1/1 Passkey Safe** 只适用于学习。Passkey 可能因域名、设备迁移或厂商策略而不可用；生产环境需要额外 Owner 和恢复流程。
- “创建 Passkey”不会发送链上交易；只有 Mint 按钮会产生实际 UserOperation。
- 本次代码没有配置 Pimlico key，因此仅完成了可构建、可测试的前端和本地 Passkey 流程，尚未进行链上部署或 NFT Mint。
