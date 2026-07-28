# Architecture Decision — Kuru Validation v0.1

## Decision

```text
[ ] Official Kuru Integration
[x] Kuru-inspired Prediction-native CLOB（研究 / Spike）
[x] Complete Set + Protocol AMM（Hackathon 正式 MVP 备选 / 当前推荐）
```

## 结论

**不采用官方 Kuru Router 作为 BTC Target Sprint 的正式交易生命周期底层。**

Kuru 已被验证为可用的 Outcome Token 现货 CLOB：自定义 ERC-20 Market、Margin Deposit、跨 Actor 限价单成交、Cancel、Withdraw 和 OutcomeVault Redeem 都已在 Monad Testnet 成功执行。

但 Target Sprint 的不可妥协条件是：

```text
tradeCutoffTime 后禁止所有新订单和旧订单成交
→ 允许撤单与取回余额
→ Pyth Settlement / Void
→ 结算后永久禁交易
```

官方 Router 创建的 Market owner 为 Router；项目 Resolver 无法调用 Router 的 `toggleMarkets`。实际 OutcomeVault 结算后，Kuru Market 仍保持 `ACTIVE` 并接受新订单。因此无法形成无信任的固定到期市场。

## 关键 Evidence

1. Kuru Market 创建成功：
   - [0xd3c8…117c](https://testnet.monadvision.com/tx/0xd3c8ca59bbf88884acb35d1cb2d5e21f87a4c26f9a3184677902148ecb18117c)
2. 两个独立 Actor 的订单成交：
   - Alice Buy：[0xcfb0…33f5](https://testnet.monadvision.com/tx/0xcfb0b33a32ba207a8303fb53ac829a2e67f6f4191a81f475c752c9c5ea9633f5)
   - Bob Sell / Fill：[0x9ddf…bd5a](https://testnet.monadvision.com/tx/0x9ddf399da5de6a5193621321e98af1d563d883b1c74dc9daf3817cdcce06bd5a)
3. OutcomeVault 已结算后仍可在 Kuru 挂单：
   - [0x0c13…ec05](https://testnet.monadvision.com/tx/0x0c13ca3ecd20930d864b08b6e9dffe5e79d8d1a003505081c1d9e9a10828ec05)

## 已验证的替代核心

本地 `PredictionCLOB` Spike 已验证：

```text
Above Bid + Below Bid
→ 用户资金 Escrow
→ 互补价格成交
→ 原子 Complete Set Mint
→ partial fill
→ highest-price priority
→ cutoff 后禁止新单 / 撮合、仍可 Cancel
→ 禁止自成交和 Cancel replay
```

Foundry 当前：`16 passed, 0 failed`。

该 Spike 不是正式可部署订单簿：没有签名订单、链表 / 索引优化、完整不变量、审计、Pyth Adapter 或 Single-Lane Rollover。它只证明 Prediction-native CLOB 的最低经济路径成立。

## 正式 MVP 推荐范围

### Hackathon 推荐：Complete Set + Protocol AMM

```text
单一 BTC Target Market
+ Test USDC
+ Above / Below
+ Pyth Target Anchor / Settlement
+ trade cutoff
+ Void
+ redeem
+ Single-Lane Rollover
```

原因：它可由项目合约完全控制 lifecycle，且已经有 Pyth Monad Testnet 真实链上更新基础。

### CLOB 后续研究路线

在 AMM 闭环完成后，再扩展 Prediction-native CLOB：

1. 原子互补 Buy Match；
2. fixed slot + cutoff；
3. Pyth `parsePriceFeedUpdatesUnique` Settlement；
4. permissionless close / settle / void；
5. price-time priority、partial fills 与签名 nonce；
6. 经济模型、fuzz、invariant 与独立审计。

## Removed Scope

- 官方 Kuru Router 直接作为 Target Sprint lifecycle 控制器；
- Kuru 订单簿的用户前端集成；
- Kuru Adapter 托管用户资产；
- 多个并行 Market；
- 外部 LP、Maker Rebate、真实资金和主网。
