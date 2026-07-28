# Risk Register

| 风险 | 严重度 | 验证状态 | 证据 / 处理 |
|---|---:|---|---|
| 官方 Kuru Market 无项目级暂停控制 | P0 | 已证实 | Router pause 的项目账户 `eth_call` revert；直接集成 No-Go |
| Kuru 结算后仍继续交易 | P0 | 已证实 | OutcomeVault settle 后 Kuru Buy tx 成功；直接集成 No-Go |
| Margin 中 Outcome Token 无法赎回 | P0 | 已排除 | 可先 withdraw，再向 Vault redeem；需在 UI 明确提示退出步骤 |
| 订单残留锁住赎回份额 | P0 | 部分缓解 | Kuru 可 cancel + withdraw，但项目无法强制 Cutoff；直接集成仍 No-Go |
| 单 Above Market 的 Below 流程过多 | P1 | 未完全解决 | `Split → sell Above → retain Below` 需多笔操作，未做安全原子 Adapter |
| Adapter 成为托管方 | P1 | 规避 | 不实现资产托管 Adapter；转 Prediction-native CLOB 或 AMM |
| 自研 CLOB 的自成交 / 假量 | P1 | 本地缓解 | Complementary PoC 已拒绝同一 trader 对敲；仍需签名 nonce 与索引层审计 |
| 部分成交、价格优先复杂度 | P1 | 本地 Spike 验证 | `PredictionCLOB` 本地覆盖 partial fill、最高价优先、cutoff/cancel；非生产实现 |
| OutcomeVault Void 舍入 / 多用户责任 | P1 | 基础覆盖 | 本地多用户 Void 与 Testnet Void 兑付；生产版需显式 roundingDust 账本和 invariant suite |
| Oracle 报告选择不确定 | P0 | 既有 Pyth Probe 已验证，尚未接入 CLOB Spike | 正式 Target Sprint 必须使用 Pyth `parsePriceFeedUpdatesUnique`、固定窗口、confidence 和 exact update fee |
| 15 分钟 Rollover / Keeper 故障 | P0 | 未接入本 Spike | 仅在选择 AMM / Prediction-native CLOB 正式路线后实现 permissionless lifecycle |
| Testnet 部署成本 | P1 | 已观察 | 每个 Kuru Market 创建约 2.15M gas；每轮新 Kuru Market 不适合 Hackathon MVP |

## 风险结论

Kuru 的交易和资产层风险可被流程缓解；但生命周期控制是不可由前端、文档或用户教育补救的 P0 协议边界。因此官方 Kuru Router 不能进入 BTC Target Sprint 的正式 MVP 路径。
