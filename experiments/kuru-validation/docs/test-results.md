# Validation Results Matrix

> `✅` = 已实际验证；`❌` = 已实际证明不满足 / Gate 阻塞；`⚠️` = 在最小 Spike 中验证但非生产级；`N/A` = 因直接 Kuru Gate No-Go，不应继续投入实现；`↗` = 使用既有独立 Pyth Testnet Proof。

## 11 个核心问题

| # | 问题 | 结果 | 结论 |
|---:|---|---|---|
| 1 | Kuru 能否创建自定义 Outcome Token 订单簿？ | ✅ | Router public `deployProxy` + 两个实际 Kuru Market |
| 2 | 创建者能否暂停 / 关闭？ | ❌ | Owner 是 Router，项目账户 pause revert |
| 3 | 支持固定 `tradeCutoffTime`？ | ❌ | 没有 per-market expiry；项目无法切换 `SOFT_PAUSED` |
| 4 | 到期后旧单是否可能继续成交？ | ✅ 负面证明 | Vault settled 后 Kuru 仍接受新单 |
| 5 | Outcome Token 可否安全经过 Margin 存取和结算？ | ✅ | Deposit → trade → withdraw → redeem 成功 |
| 6 | 每轮新 Token / Market 是否可接受？ | ❌ | Kuru Market 创建真实 gas 约 `2,155,860`，且 lifecycle 不可控 |
| 7 | 单 Above 市场能否合成 Below？ | ⚠️ | 数学路径成立，但多交易 UX / 原子性未通过 Gate |
| 8 | Kuru 能否支持 Complete Set Mint / Merge？ | ⚠️ | Vault 独立可行；Kuru 无预测市场原子组合接口 |
| 9 | 一笔完成 Vault + Margin + Kuru？ | ❌ | 官方没有该预测市场 atomic composer；未引入托管 Adapter |
| 10 | Oracle Resolver 能否到期关闭？ | ❌ | Resolver 无 Router owner 权限 |
| 11 | 自研 Prediction CLOB 最小范围？ | ✅ | 互补 Buy Bid、escrow、partial fill、priority、cancel、cutoff、settlement 前后边界 |

## Phase 状态

| Phase | 状态 | 验证产物 / 结果 |
|---|---|---|
| 0 官方能力与权限 | ✅ | `kuru-capability-matrix.md`；源码、RPC、权限 Revert |
| 1 Kuru 基础市场 | ✅ 核心路径 | 实际创建、Deposit、跨 Actor Buy/Sell Fill、Cancel、Withdraw；部分 Fill + batch Cancel 已在第二个 Testnet Market 执行 |
| 2 到期与 Pause | ✅ 负面 Gate | 无项目级 Pause；结算后仍交易；直接 Kuru No-Go |
| 3 OutcomeVault | ✅ 最小验证 | Split / Merge / Above / Below / Void / 多用户 / 重复操作 / fuzz conservation |
| 4 Kuru + Vault | ✅ Above 退出；⚠️ Below 合成 | Above 二级交易与退出完整；Below 合成被判定为非原子多步 UX 风险 |
| 5 Complementary Match | ✅ 本地 PoC | 完全抵押、两方 Outcome、taker price improvement、cancel、self-match rejection |
| 6 简化 Prediction CLOB | ✅ 本地 Spike | partial fill、最高价优先、cancel、cutoff、replay rejection |
| 13 Lifecycle / Keeper | ✅ 最小验证 | 本地 cutoff 状态机与 permissionless close；官方 Kuru 因权限失败 |
| 14 Oracle | ↗ / ⚠️ | Pyth BTC/USD Pull Oracle 已在 Monad Testnet 真实验证；未与官方 Kuru 结合，因为 Phase 2 已 No-Go |
| 15–16 账户与攻击 | ✅ 最小矩阵 | Alice/Bob actor、self-match、replay cancel、post-settlement trade、无权限 Pause、余额锁定路径 |
| 17 性能 | ⚠️ | Kuru create / order gas receipts保留；未将 20 笔压力测试当作 Go Gate |

## 本地 Foundry 结果

```text
16 passed, 0 failed
```

覆盖：

- Complete Set split/merge 及 256-run fuzz conservation；
- Above、Below、Void、多用户兑付、重复赎回、结算后 mutation rejection；
- Complementary Buy Match、atomic-unit rounding、taker price improvement、cancel、self-match rejection、resolved-market escrow rejection；
- Prediction CLOB partial fill、highest-price priority、cutoff、cancel-after-cutoff、replay rejection。

## Testnet Evidence

- [Kuru Market create](https://testnet.monadvision.com/tx/0xd3c8ca59bbf88884acb35d1cb2d5e21f87a4c26f9a3184677902148ecb18117c)
- [Two-actor Kuru Buy](https://testnet.monadvision.com/tx/0xcfb0b33a32ba207a8303fb53ac829a2e67f6f4191a81f475c752c9c5ea9633f5)
- [Two-actor Kuru Sell / Fill](https://testnet.monadvision.com/tx/0x9ddf399da5de6a5193621321e98af1d563d883b1c74dc9daf3817cdcce06bd5a)
- [OutcomeVault Above resolve](https://testnet.monadvision.com/tx/0x544c89ecf43426d31e9f815d22c42a6a60c4d271497827f6221d72167818118a)
- [OutcomeVault Above redeem](https://testnet.monadvision.com/tx/0xc6b7ffa1ea5149f2f565ae7100698e942eea048a7abd434fa1dbd47da3a13930)
- [Kuru order accepted after settlement](https://testnet.monadvision.com/tx/0x0c13ca3ecd20930d864b08b6e9dffe5e79d8d1a003505081c1d9e9a10828ec05)
- [Kuru partial-fill buy](https://testnet.monadvision.com/tx/0x7601ba2d2ddd0a178942fd5b4841889ed9f60aa481a63b9cce8cb27d45f66432)
- [Kuru cancel remainder](https://testnet.monadvision.com/tx/0xd9f73f4e65a4a6e4437c1f2f1df629710bd542e0cdcbc0ce7eafd82611e21c11)
- [Kuru batch cancel](https://testnet.monadvision.com/tx/0xd49e815c774e0b8aabc9f9003d8ea449dd5461d7eb70f92ecec795971ce471aa)
- [Below resolve](https://testnet.monadvision.com/tx/0xab3c0e1eeed5350c53ccfe43a684703e4f46be83dea4f98bc5a4485b312520ae)
- [Void resolve](https://testnet.monadvision.com/tx/0xc6b342c1c4505716d5449706975bb765a328805b8d29ac334ad5e8be119cbf21)

## Final Decision

```text
Official Kuru Integration: NO-GO
Prediction-native CLOB: technical core validated, not production-ready
Hackathon MVP: Complete Set + Protocol AMM + Pyth Settlement
```
