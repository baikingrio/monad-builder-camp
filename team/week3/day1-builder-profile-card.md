# Week 3｜Builder Profile Card

- **Builder**：Q
- **主方向**：Dev Builder
- **本周投入**：每天约 2 小时；周五晚可集中投入更多时间。

## 我可以为团队做什么

我负责把团队的想法收敛成可检查的 Monad 原型，主要承担：

- 前端 Prototype / Proof 页面实现；
- Monad Testnet 的合约、只读 RPC 与链上验证；
- Foundry 测试、运行记录与 Known Issues 整理；
- 钱包、账户抽象和权限边界的技术说明；
- README、Demo Evidence 和 3 分钟展示中的技术部分。

## 已有 Proof of Work

- [Monad 学习实验](https://github.com/baikingrio/monad-builder-camp/tree/main/experiments/monad-playground)
- [ERC-7702 Testnet 学习记录](https://github.com/baikingrio/monad-builder-camp/blob/main/daily/2026-07-12.md)
- [Safe 与 Monad 4337 实践记录](https://github.com/baikingrio/monad-builder-camp/blob/main/daily/2026-07-19.md)
- [Week 3 Dev Builder Role Statement](https://github.com/baikingrio/monad-builder-camp/blob/main/notes/week2/2026-07-14-week3-role-statement.md)

## 本周想做的方向

**Monad Account Abstraction Practice Lab（账户抽象实践与 Proof Demo）**：围绕 Safe 1.4.1、Safe 4337 Module 与 EntryPoint v0.7，做一个帮助学习者理解并核查 Monad Testnet 账户抽象基础设施与交互边界的最小实践项目。

用户可以查看一条预设的账户抽象操作：它要完成什么、Safe / Module / EntryPoint 分别负责什么、是否需要 Owner 明确签名，以及哪些信息可以在链上或通过只读 RPC 核查。Demo 不替用户自动执行交易。

## 团队协作

当前团队已经具备 Research、Ops 和 Dev 三类核心分工。本周由现有成员先完成最小闭环：Research 负责场景与事实核查，Ops 负责叙事与用户反馈，Dev 负责原型、测试网验证与技术 Proof。当前不额外招募队友。

## 按 WCB 模板的提交内容

- **我的方向**：Dev Builder
- **我会什么**：Monad Testnet 合约与只读验证、Nuxt 前端原型、Foundry 测试、账户抽象和权限边界整理、README 与 Demo Proof。
- **我想做什么**：完成一个 Monad Account Abstraction Practice Lab，围绕 Safe 1.4.1、Safe 4337 Module 与 EntryPoint v0.7 展示账户抽象操作的权限边界和可验证证据。
- **我希望寻找的队友**：当前已与 Hagoo（Research）和 ritscher（Ops）组成团队，三类核心分工已覆盖，本周不额外招募队友。
- **本周可以投入的时间**：每天约 2 小时；周五晚可集中投入更多时间。
- **我的作品或资料链接**：[Monad 学习实验](https://github.com/baikingrio/monad-builder-camp/tree/main/experiments/monad-playground)、[Safe 与 Monad 4337 实践记录](https://github.com/baikingrio/monad-builder-camp/blob/main/daily/2026-07-19.md)。

## 安全与 Scope 边界

- 只使用 Monad Testnet；
- 不做真实资产操作；
- 不收集私钥、助记词或敏感配置；
- 不提供公开 relayer、任意 calldata 执行或自动资产操作；
- 真实链上数据、只读验证、mock 页面和后续计划会明确区分。

## 60 秒自我介绍

大家好，我是 Q，这周以 Dev Builder 身份参与。上周我主要完成了 Monad Testnet、账户抽象和安全交互相关的实践，包括 ERC-7702、ERC-4337、前端 Proof 页面和 Foundry 测试。我希望把这些已有的真实学习成果收敛成一个小而清楚的 Demo：用户能看到一个预设账户交互的目的、权限边界和链上验证证据，而不是把复杂的钱包或自动交易直接交给 Agent。团队里我可以负责前端原型、Monad Testnet 验证、测试和技术说明。我们已有 Research 和 Ops 同学，现在希望再找一位熟悉前端、合约或测试的 Dev 搭子，一起把 Demo 打磨得更好理解、更容易展示。本周只在 Monad Testnet 做验证，不做真实资产操作。
