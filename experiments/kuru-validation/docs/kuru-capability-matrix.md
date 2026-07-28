# Kuru Capability Matrix

> 基于 Kuru 官方文档、公开源码 commit `2060bb2736080c175d80d568bfdb6226bb5abd04`、Monad Testnet 只读 RPC 及实际广播验证。
>
> 结论必须区分“协议具备此能力”和“BTC Target Sprint 项目可无信任地控制此能力”。

| 能力 | 官方 / 源码结论 | 实测 / Proof | Target Sprint 是否满足 |
|---|---|---|---|
| 自定义 ERC-20 Market 创建 | `Router.deployProxy` 为 public | 已创建 `Above / ttUSDC` Market：[`0xd3c8…117c`](https://testnet.monadvision.com/tx/0xd3c8ca59bbf88884acb35d1cb2d5e21f87a4c26f9a3184677902148ecb18117c) | ✅ |
| 自定义 Token Margin Deposit | Margin Account 接受 ERC-20；仅 verified market 可记账 | Above 与 ttUSDC 已真实 Deposit 并成交 | ✅ |
| 限价单、成交、撤单 | OrderBook 支持 Buy/Sell 和 `batchCancelOrders` | 两 Actor Buy / Sell 成交；此前 Market 上单笔 Cancel + Withdraw 成功 | ✅ |
| 部分成交 | Kuru OrderBook 撮合函数支持部分填充 | 尚未在官方 Kuru Testnet 以两个 Actor 完成专项 Proof | ⚠️ 未作为直接路线 Gate 的阻塞项 |
| `SOFT_PAUSED` 语义 | 源码中交易入口要求 `ACTIVE`；Cancel 使用 `marketNotHardPaused` | 官方文档也说明软暂停保留取消、充值、提现 | 协议语义 ✅ |
| 项目方触发 `SOFT_PAUSED` | `OrderBook.toggleMarket` 要求 owner；Router `toggleMarkets` 为 `onlyOwner`；Router 在创建时成为 OrderBook owner | 项目账户 `eth_call` 触发 Router pause 得到 revert `0x82b42900` | ❌ P0 |
| 固定 `tradeCutoffTime` | Kuru Market 本身无 per-market cutoff 参数或订单 expiry | OutcomeVault 已结算后 Kuru 仍接受新 Buy：[`0x0c13…ec05`](https://testnet.monadvision.com/tx/0x0c13ca3ecd20930d864b08b6e9dffe5e79d8d1a003505081c1d9e9a10828ec05) | ❌ P0 |
| 结算后禁交易 | Kuru 与 OutcomeVault 无自动生命周期绑定 | Market `marketState() = ACTIVE`，结算后订单成功 | ❌ P0 |
| Outcome Token 从 Margin 退出 | 用户可 withdraw ERC-20；Vault 赎回需要 Token 不再锁在 Margin | Alice 成功 withdraw Above 后 resolve/redeem | ✅，但 UX 多一步 |
| Oracle Resolver 关闭市场 | 需 OrderBook / Router owner | 项目 Resolver 不具备该权限 | ❌ P0 |
| 单 Above 市场合成 Buy Below | 经济上可通过 `Split → Sell Above → retain Below` | 尚未以用户脚本、原子 Adapter 和失败恢复完成验证 | ⚠️ UX / 原子性风险 |
| 单 Above 市场合成 Sell Below | 需 `Buy Above → Merge` | 尚未完成 Kuru 专项验证 | ⚠️ UX / 流动性风险 |
| 原子 Vault + Margin + Kuru 操作 | 官方 Router 不提供预测市场专用原子组合入口 | 未实现安全 Adapter；不应由 Adapter 托管用户资产 | ❌ / 未验证 |

## 官方直接集成结论

```text
Official Kuru Integration: No-Go
```

不是因为 Kuru 不支持全链上订单簿或 Outcome Token，而是项目无法把 Kuru 的 Market State 绑定到 Target Sprint 的 `tradeCutoffTime`、Settlement 与 Void 生命周期。

## 重新进入评估的前提

只有下列任一项得到 Kuru 官方的链上、可复现证明后，才重开直接集成评估：

1. 单 Market 的 `SOFT_PAUSED` Operator delegation；
2. 可安全将 Market owner 委托 / 转移给 Target Sprint Resolver；
3. 协议提供不可绕过的 per-market expiry / settlement hook。
