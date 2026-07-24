# Monad Lucky Draw

Monad Testnet 上的独立账户抽象抽卡实验。用户用自己的 EOA 完成首次明确授权，获得可预测的 AA Safe 地址，并在受限 Pimlico Paymaster 赞助下完成一次抽卡。

> 当前状态：**仅首次激活可由 Pimlico 赞助；Session 启用与后续免弹窗抽卡均由当前 Safe 的 EntryPoint Deposit 支付 Gas。自建 Faucet 仍未实现。**

## 体验路径

1. 连接 EOA，并签署带 nonce 与过期时间的身份绑定消息；
2. 推导对应的 counterfactual Safe 地址（Safe 1.4.1 + Safe4337Module v0.3 / EntryPoint v0.7）；
3. 用户主动检查 Safe 链上部署状态（只读 `eth_getCode`）；
4. 用户点击「激活并免费抽一次」→ 服务端 Pimlico 赞助固定 `draw()` → 钱包签署 Owner UserOperation → 广播并等待 receipt；
5. 用户 EOA 向固定 EntryPoint 调用 `depositTo(currentSafe)` 充值原生 MON；
6. 用户点击「启用免弹窗抽奖」→ 浏览器生成 Session Key → **一次** Owner 授权安装 Zodiac Roles（Session Key = member，非 owner；Deposit 支付 Gas + tip Session Key）；
7. 之后「免弹窗抽奖」由 Session Key EOA 调 `execTransactionWithRole(draw)`，自付 native gas，**无次数上限**，仍受 24h TTL（legacy owner-session 仍为最多 3 次）；
8. 仅在拿到公开 hash / receipt 后展示 MonadVision 链接。

详细执行计划：[`docs/2026-07-22-implementation-plan.md`](./docs/2026-07-22-implementation-plan.md)。  
Pimlico Sponsor 设计：[`docs/superpowers/specs/2026-07-22-pimlico-sponsor-activation-design.md`](./docs/superpowers/specs/2026-07-22-pimlico-sponsor-activation-design.md)。  
Session Key 设计：[`docs/superpowers/specs/2026-07-22-session-key-draw-design.md`](./docs/superpowers/specs/2026-07-22-session-key-draw-design.md)。  
Zodiac Roles 迁移：[`docs/zodiac-roles-migration-runbook.md`](./docs/zodiac-roles-migration-runbook.md)。  
链上 Proof：[`docs/onchain-proof.md`](./docs/onchain-proof.md)。

## 已验证的链上基础

`MonadLuckyDraw` 已部署到 Monad Testnet：

- 合约地址：[`0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70`](https://testnet.monadvision.com/address/0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70)
- 部署交易：[`0x87a0966b743ee749b7af9e1fd7cbe6b8d8e04c6e454ed6a42592dfadba9d7ee6`](https://testnet.monadvision.com/tx/0x87a0966b743ee749b7af9e1fd7cbe6b8d8e04c6e454ed6a42592dfadba9d7ee6)

首次赞助激活与免弹窗抽奖（示例）：

- Safe：[`0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276`](https://testnet.monadvision.com/address/0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276)
- 激活交易：[`0xfd3e1a879728595da7ce01fac221b91a0f9c25beeb1481f32420faab7245fc11`](https://testnet.monadvision.com/tx/0xfd3e1a879728595da7ce01fac221b91a0f9c25beeb1481f32420faab7245fc11)
- 免弹窗抽奖：[`0x4d334a92634567482bd906afe4b2cccc325de152bd936ccb2641af9618dfb604`](https://testnet.monadvision.com/tx/0x4d334a92634567482bd906afe4b2cccc325de152bd936ccb2641af9618dfb604)

## 启用 Sponsor（Pimlico）

在 `.env` 中（参考 `.env.example`）：

- `LUCKY_DRAW_SPONSOR_SIGNING_ENABLED=true`
- `LUCKY_DRAW_SESSION_SECRET`（≥32 字符）
- `LUCKY_DRAW_PIMLICO_API_KEY`（Dashboard 需启用 Monad）
- `LUCKY_DRAW_SPONSOR_MAX_GAS` / `LUCKY_DRAW_SPONSOR_TOTAL_BUDGET`
- `LUCKY_DRAW_SAFE_4337_MODULE=0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226`

**不需要** `LUCKY_DRAW_SPONSOR_PRIVATE_KEY`（本 Demo 仅使用 Pimlico Paymaster）。

## 安全边界

- 仅 Monad Testnet（Chain ID `10143`），不处理真实资产；
- 浏览器绝不保存 Paymaster Key 或运营私钥；
- Sponsor 默认应视为需显式开启；资格记录、限流、预算与熔断器在服务端执行；
- 登录签名只用于身份绑定，不等同于链上 AA Owner 授权；
- EntryPoint 充值仅构造固定 `EntryPoint.depositTo(currentSafe)` 钱包交易；应用不托管 MON，也不接受浏览器指定 EntryPoint、RPC 或受益人；
- 当前产品路径为 Zodiac Roles Session（Session Key = Roles member，非 Safe owner）：[`docs/zodiac-roles-migration-runbook.md`](./docs/zodiac-roles-migration-runbook.md)。自付 gas，无次数上限；仍保留 24h TTL。Safe7579 已归档：[`docs/safe7579-migration-runbook.md`](./docs/safe7579-migration-runbook.md)；
- 当前「领取测试 MON」仅提供官方 Faucet 说明；自建 Faucet 需独立安全 Gate。

## 初始化后运行

```bash
cd experiments/monad-lucky-draw
cp .env.example .env
npm install
npm test
npm run dev
```

不要提交 `.env`、私钥、Pimlico Key、Foundry broadcast / cache 或任何生产凭证。
