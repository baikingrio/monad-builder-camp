# Pimlico Sponsor + 真实激活抽卡设计

**日期：** 2026-07-22  
**状态：** 已批准（用户确认 A + 同意）

## 目标

在 Monad Testnet 上完成一次真实赞助的 Safe 激活 + `LuckyDraw.draw()` UserOperation，并在 UI 中仅在拿到公开 hash/receipt 后展示成功。

## Sponsor 模型

- Sponsor = Pimlico Verifying Paymaster（服务端 `LUCKY_DRAW_PIMLICO_API_KEY`）
- 不要求 `LUCKY_DRAW_SPONSOR_PRIVATE_KEY`
- Bundler：`https://api.pimlico.io/v2/monad-testnet/rpc?add_balance_override&apikey=…`（密钥仅服务端闭包）
- 开关：`LUCKY_DRAW_SPONSOR_SIGNING_ENABLED=true`，且 session secret / maxGas / budget / Safe4337 module / target 齐全

## 安全边界

- 仅 chainId `10143`
- 固定 LuckyDraw 合约与 `draw()` selector，`value = 0`
- EOA + Safe 各仅一次首次赞助（SQLite `claimOnce`）
- IP / EOA 限流、总预算、熔断器
- 浏览器不持有 Paymaster / API Key
- 登录 EIP-191 ≠ 链上 Owner UserOp 签名

## 用户路径

1. EOA 连接 + 登录（既有）
2. 推导 counterfactual Safe + 可选 eth_getCode（既有）
3. 点击「激活并免费抽一次」
4. `POST /api/draw/activate`：session + gates + claim → 构建 EP v0.7 UserOp → Pimlico sponsor → 返回待签 UserOp
5. 浏览器 Owner 签名 UserOp
6. `POST /api/draw/submit`：校验后 `eth_sendUserOperation` → 轮询 receipt
7. UI 展示公开链接；失败如实显示

## 明确不做

- Session Key 免弹窗
- 自建 Faucet
- 自建 sponsor 私钥签发
