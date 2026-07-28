# Validation Plan Tracking

本目录执行的计划来源于用户提供的 `Monad BTC Target Sprint — Kuru 链上订单簿验证计划 v0.1`。

执行结果不以“把完整交易所做完”为验收，而是回答该计划的 11 个核心问题并产生可复核的 Go / No-Go 决策。

- 完整逐项结果：[test-results.md](test-results.md)
- 官方 Kuru 能力与权限：[kuru-capability-matrix.md](kuru-capability-matrix.md)
- 最终路线：[architecture-decision.md](architecture-decision.md)
- 风险：[risk-register.md](risk-register.md)

最终结论：官方 Kuru Router 直接集成因无法由项目控制 Cutoff / Settlement 后停市而为 **No-Go**；Prediction-native CLOB 的最小经济路径已在本地 Spike 验证；Hackathon MVP 推荐回到 Complete Set + Protocol AMM + Pyth Settlement。
