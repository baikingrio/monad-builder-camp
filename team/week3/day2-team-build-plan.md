# Week 3 Day 2｜Team Build Plan

## 本周交付目标

在 Week 3 Day 5 前完成一个可复现的 **Monad Account Abstraction Practice Lab**：学习者能在页面中理解 Safe 4337 的组成，检查 Monad Testnet 的基础合约，并辨别真实验证、预设说明和仍未实现的发送能力。

## 任务拆分与依赖

### Hagoo｜Research

- 完成用户痛点和学习场景核查；
- 核对 Monad / Safe 官方资料、支持边界与地址来源；
- 输出风险、待验证假设和 Monad Fit 建议。

**依赖与交付：** 在 Day 3 开始前给出资料链接、事实结论和不可宣称的能力清单，供页面和 README 采用。

### ritscher｜Ops

- 将问题整理为一句话叙事和测试邀请；
- 设计 3–5 位测试者的提问脚本；
- 准备 3 分钟展示流程和反馈记录模板。

**依赖与交付：** 在 Day 3 内给出测试邀请文案与问题；Day 4 汇总反馈，标出 Must Fix / Should Fix / Later / Won’t Fix。

### Q｜Dev

- 复用 `/safe-4337-monad` 页面与 Monad Testnet 固定地址；
- 增加预设 UserOperation 学习案例和发送前检查，使页面能区分“可读证据”和“未发送操作”；
- 维护自动化测试、实践 README、截图 / 录屏的技术说明；
- 在每次改动后验证测试与生产构建。

**依赖与交付：** Day 3 前形成首个可本地演示版本；Day 4 根据反馈只修复最影响理解的一项问题；Day 5 给出稳定的展示链接、测试结果和 Known Issues。

## 节奏

- **Day 2**：确认 Problem & User Card、Monad Fit、范围和本计划；
- **Day 3**：合并资料与页面，完成第一条可演示学习链路；
- **Day 4**：找 3–5 位测试者，归档反馈，冻结 Demo；
- **Day 5**：3 分钟展示、同伴反馈、复盘和 Hackathon Readiness Card。

## 待团队确认（不在确认前伪造事实）

- 团队名称；
- 日常沟通工具 / 频道；
- 每日 15 分钟同步时间；
- 任务看板位置；
- 决策方式和成员缺席处理。

确认后将补入 [Day 1 Team Formation Card](day1-team-formation-card.md)。

## 验收清单

- [ ] 页面可本地启动并展示预设案例；
- [ ] 三份基础合约可链接至 MonadVision，且只读验证可运行；
- [ ] README 明确真实 / 只读 / 预设 / 未实现边界；
- [ ] 自动化测试与生产构建通过；
- [ ] 有截图或录屏与公开仓库链接；
- [ ] 至少完成一次团队外用户测试与反馈归档。
