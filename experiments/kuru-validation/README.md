# Kuru Validation Spike（本地验证中）

> 状态：**Phase 0、Phase 1–2 已完成。Kuru 链上订单、跨 Actor 成交、提现和 OutcomeVault 赎回均已在 Monad Testnet 验证；官方 Kuru Router 直接集成的生命周期 Gate 为 No-Go。**

本实验对应 `Monad BTC Target Sprint — Kuru 链上订单簿验证计划 v0.1`，用于决定 BTC Target Sprint 是否应直接接入 Kuru，或采用 Prediction-native CLOB / Complete Set + AMM。

## 验证文档索引

- [完整结果矩阵](docs/test-results.md)
- [Kuru 能力矩阵](docs/kuru-capability-matrix.md)
- [Monad Testnet Phase 1–2 Proof](docs/testnet-phase1-results.md)
- [风险登记](docs/risk-register.md)
- [最终架构决策](docs/architecture-decision.md)

## 已完成的只读验证

### 官方 Kuru Testnet 预检

- Chain ID：`10143`
- Router：`0x7EFbE105Ca7415dE98F96622173458ac1c054630`
- Margin Account：`0xd029C2D98ff85D8F64799017fE00a59B1159CE02`
- Kuru Deployer：`0xDacd06372cEb638640c9D8466A023b7362324e1A`
- 官方 Testnet USDC：`0x3bA3d39AFcf8bb994f7964B3e0171Ea2Ba361570`

通过 Monad Testnet RPC 确认链 ID 和上述地址的合约代码。该预检为只读；后续的独立 Phase 1–2 广播 Proof 见 [docs/testnet-phase1-results.md](docs/testnet-phase1-results.md)。

### 官方源码审阅

审阅来源：

- Kuru 合约 commit：[`2060bb2736080c175d80d568bfdb6226bb5abd04`](https://github.com/Kuru-Labs/Kuru-contracts-dex-public/tree/2060bb2736080c175d80d568bfdb6226bb5abd04)
- [Kuru Contract Addresses](https://docs.kuru.io/contracts/Contract-addresses)
- [Kuru OrderBook](https://docs.kuru.io/contracts/OrderBook)
- [Kuru Deploy Market](https://docs.kuru.io/sdk/deploy-market)

已确认：

1. `Router.deployProxy(...)` 为 `public`，可为自定义 ERC-20 / ERC-20 创建 Kuru 市场。
2. Router 创建市场时将 OrderBook owner 固定为 `address(this)`，即官方 Router，而非市场创建者。
3. `OrderBook.toggleMarket(...)` 仅 owner 可调用；`Router.toggleMarkets(...)` 也为 `onlyOwner`。
4. `SOFT_PAUSED` 的语义是停止交易，同时保留取消、充值、提现路径；它是预测市场 Cutoff 所需的正确状态。
5. Margin Account 支持任意 ERC-20 的 `deposit` / `withdraw`，Router 注册的市场可使用其余额记账。

## Gate 0 决策

| 维度 | 结果 |
|---|---|
| 自定义 Outcome Token 市场 | ✅ 可创建 |
| 链上限价单、成交、部分成交、撤单 | ✅ Kuru 支持 |
| Margin Account 中自定义 ERC-20 存取 | ✅ 代码路径支持 |
| Target Sprint Resolver 独立执行 Cutoff | ❌ 官方 Router 路径不满足 |

因此，**官方 Kuru 直接集成暂定 No-Go**：除非 Kuru 能证明市场级暂停权限可委托给项目 Resolver，或允许安全地将 Market Owner 转移给项目控制合约。

## 本地 Phase 3 / Phase 5 PoC

`contracts/` 是纯本地 Foundry 实验，不包含 RPC、私钥、广播脚本或真实资金。

包含：

- `MockERC20.sol`：6 decimals Mock USDC；
- `OutcomeToken.sol`：仅 OutcomeVault 可 mint/burn 的最小 ERC-20 Outcome Share；
- `OutcomeVault.sol`：Complete Set `split` / `merge` / `resolve` / `redeem`；
- `ComplementaryMatchPoC.sol`：仅验证等量互补 Buy Order 的原子 Complete Set 铸造，不是完整订单簿。

已通过的本地测试：

```text
16 passed, 0 failed

- split → merge 会返还抵押并销毁两侧 Share
- Above、Below、Void 与多用户赎回
- 结算后禁止 Split / Merge 与重复 Redeem
- 互补 Bid 原子铸造、价格改善退款、Cancel、自成交拒绝
- Prediction CLOB partial fill、最高价优先、cutoff、Cancel 与 replay 拒绝
```

## 当前未实现范围

本地 Complementary Match PoC 仍然**不支持**：

- 部分成交；
- 多价档 / 价格时间优先；
- Sell Order；
- Pyth Anchor / Settlement；
- Cutoff 状态机；
- 自动化或 permissionless Market lifecycle。

Kuru 的 Testnet 直接集成已验证交易与退出路径，但由于项目无法控制官方 Router 的 `SOFT_PAUSED`，不应进入 Target Sprint 正式 MVP。完整链上结果见 [docs/testnet-phase1-results.md](docs/testnet-phase1-results.md)。
