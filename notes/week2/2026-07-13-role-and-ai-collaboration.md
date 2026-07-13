# Week 2｜Dev Builder 角色选择与 AI 协作记录

日期：2026-07-13
方向：Dev Builder

## Role Choice Card

### 我选择的主方向

我选择 **Dev Builder**。

我希望解决的问题是：当用户或 AI Agent 发起 Monad 链上操作时，怎样让交易从“能发出去”变成“用户能理解、执行前能检查、关键边界能被验证”。我比较关注账户权限、Gas 赞助、交易模拟和链上 Proof，而不只把目标放在做出一个能点的页面。

### 选择理由

我已经在 Monad Testnet 上完成过合约开发、Foundry 测试、部署、交互和前端 Proof 页面；最近继续做了 ERC-4337 Sponsor 授权边界与 ERC-7702 EOA 委托实践。相比转向纯运营或纯研究，我更适合把学习到的安全约束做成可运行、可验证的技术材料，再配合清楚的文档说明。

### 我想服务的场景

一个用户让 AI 协助完成链上任务、兑换或资金操作时，不能只把自然语言直接变成 calldata。中间至少需要有：

1. 明确的意图和额度；
2. 可模拟的交易结果；
3. 对权限、目标地址和 Gas 责任的限制；
4. 用户最终确认；
5. 可复查的链上或测试 Proof。

### 本周最小产出

- 完成一次对 Moss 的真实开源项目阅读，并写清它如何通过 `discover → load → action → simulate` 约束 Agent 交易；
- 记录一个可执行的小型贡献方向：为 Moss 补充更面向新手的 Quick Start / FAQ 建议，先完成资料核查和贡献计划；
- 保持 Monad 实验的公开技术 Proof：ERC-4337 Sponsor 授权、ERC-7702 受限 Executor、Foundry 测试与只读前端页面；
- 尝试完成一次真实 GitHub 协作。若提交 PR 前仍缺少足够验证，则优先提交带上下文和具体改进建议的 Issue，而不是为了任务勉强提交低质量改动。

### 参考资料

- [Moss README](https://github.com/nishuzumi/moss)
- [Moss Getting Started](https://github.com/nishuzumi/moss/blob/main/docs/getting-started.md)
- [Moss Agent Skill Guide](https://github.com/nishuzumi/moss/blob/main/docs/agent-skill.md)
- [本人的 ERC-7702 学习记录](https://github.com/baikingrio/monad-builder-camp/blob/main/daily/2026-07-12.md)

### Week 3 想承担的角色

进入 Week 3 团队后，我可以承担智能合约与链上交互实现、交易模拟前的安全检查、Foundry 测试、Monad Testnet 验证，以及把真实结果整理为前端 Proof / README 的工作。

---

## Week 2 Role Log

### 2026-07-13｜起点与本周问题

**已有基础**

- Monad Testnet 合约开发、部署、源码验证和写入交互；
- ERC-4337 智能账户、Session Key 与 Sponsor 授权的学习实践；
- ERC-7702 真实 `type 0x04` 委托交易，以及只允许固定 relayer 调用固定 Target 的受限 Executor；
- Nuxt 前端只读 Proof 页面与 Foundry 测试。

**今天阅读的资料**

- Moss README、Getting Started、Agent Skill Guide、Protocol Onboarding、CONTRIBUTING；
- Moss GitHub Issue [#16](https://github.com/nishuzumi/moss/issues/16)：面向新手的 Quick Start 建议。

**Prompt / AI 协作主题**

我用 AI 协助把开源仓库中分散的 README、入门文档、Agent 安全规则和贡献规范整理成阅读清单；但没有把 AI 的摘要直接当结论，而是回到原始文档核对术语、边界和链接。

**判断变化**

一开始我把“AI 辅助交易”理解为前端把用户意图转成链上调用。读完 Moss 后，我更认可把链路拆成“发现能力、加载约束、构建未签名 Plan、模拟核对结果、用户钱包确认”。其中模拟无警告并不等于用户意图已经被满足，仍要人工/Agent 对照用户真正想支付和获得的内容。

**遇到的问题**

Moss 仍是 alpha，README 明确说明未审计，模拟只反映模拟时刻的链上状态。因此不能把“模拟无 warning”写成交易结果保证，也不能把它当作可以跳过钱包确认的理由。

**下一步**

1. 继续核对适合新手贡献的文档缺口；
2. 选定一个范围小、可复查的 GitHub 协作动作；
3. 在提交前按项目贡献规范验证内容和链接；
4. 后续活动结束后再补上活动截图与真实收获。

---

## AI Collaboration Log

### AI 协助了什么

- 协助梳理 Moss 的模块关系、核心流程和文档入口；
- 把我已有的 ERC-4337 / ERC-7702 实验与 Moss 的“先模拟、再确认”思路做对照；
- 协助起草 Role Choice、学习日志和开源贡献计划；
- 协助列出提交前的隐私与事实核查清单。

### 我人工核查或删改了什么

- 逐项阅读 Moss 的 README、Getting Started、Agent Skill Guide 与 CONTRIBUTING，确认项目确实不签名、不发送交易，且要求每个 Plan 必须模拟；
- 核对 Moss 当前仅面向 Monad mainnet、项目处于 alpha、未审计等限制，避免把实验能力写成生产承诺；
- 核对 GitHub 公开 Issue #16 的内容，确认它提出的是 Quick Start 文档改进建议；
- 对链上相关描述只保留自己已经完成并有公开 Proof 的结果，不把本地设想写成已上线功能；
- 删除任何可能涉及私钥、API Key、课程钱包配置和未公开活动链接的内容。

### 不能交给 AI 的判断

- 私钥、助记词、签名、钱包连接和链上交易确认；
- 对真实资产、授权额度、spender、目标合约和 Gas 预算的最终决定；
- 判断一个开源贡献是否真实解决问题、是否符合 Maintainer 的边界；
- 未经源码、链上数据或官方文档验证的安全结论；
- 对外承诺一个功能已经安全、可用或一定会成功。

我的结论是：AI 可以加快阅读、整理和初稿产出，但交易意图、权限边界、链上验证和最终确认必须由人负责。
