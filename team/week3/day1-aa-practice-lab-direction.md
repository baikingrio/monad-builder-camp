# Week 3｜Monad Account Abstraction Practice Lab

## 一句话

做一个面向学习者的 Monad Testnet 账户抽象实践页面：用 Safe 1.4.1、Safe 4337 Module 和 EntryPoint v0.7 解释一条 UserOperation 从配置、验证到需要 Owner 确认的过程，并把真实链上证据、只读结果与未实现部分分开展示。

## 用户与核心动作

- **目标用户**：刚开始接触智能账户和 ERC-4337 的 Monad Builder。
- **核心动作**：打开页面，查看预设的账户抽象案例，理解 Safe、4337 Module、EntryPoint 的职责，验证基础合约在 Monad Testnet 存在，并了解发起 UserOperation 前还缺少哪些用户确认与基础设施配置。

## 当前已有的真实基础

- Monad Testnet 上已完成 Safe 1.4.1、Safe 4337 Module、EntryPoint v0.7 三份基础合约的只读 bytecode 验证。
- 已有 Nuxt 页面 `/safe-4337-monad`、相关实践说明和测试。
- 已验证的内容不等于已经创建 Safe、发送 UserOperation 或完成 Paymaster 赞助；这些状态会如实标注。

## 本周 Scope

### Must Have

1. 清楚介绍 Safe、Safe 4337 Module、EntryPoint v0.7 的职责和关系。
2. 让用户通过页面或可复现步骤检查三份 Monad Testnet 基础合约的链上代码。
3. 展示一份预设 UserOperation 的结构和执行前检查：目标、value、calldata、Owner 签名、Bundler / Paymaster、模拟结果。
4. 写清真实实现、只读验证、mock 内容、Known Issues 与安全边界。
5. 提供 README、截图或录屏，以及 Monad Explorer / RPC 验证证据。

### 可选实践升级

在团队确认 Provider 兼容性、完成模拟且由 Owner 明确操作的前提下，尝试一个 **零 value 的 Monad Testnet UserOperation**。只有实际获得公开可验证的 hash 后，才将其标为已发送的链上实践；否则保持为“待完成的模拟 / 配置步骤”。

### Not This Week

- 主网或真实资产操作；
- 自动发送交易、公开 Sponsor、公开 relayer；
- 收集或展示私钥、助记词、未受限 API Key；
- 将 Safe Passkey Module 描述为 Monad Testnet 官方支持能力；
- 完整通用 Agent、多协议聚合或生产级钱包产品。

## 团队协作

- **Hagoo / Research**：确认用户学习痛点、官方资料、Safe / Monad 支持范围、风险和待验证假设。
- **ritscher / Ops**：完善一句话叙事、测试邀请、用户反馈问题、Demo 展示流程。
- **Q / Dev**：复用 Nuxt 与 Monad Testnet 实践、实现或整理 Proof 页面、测试和 README，明确技术边界。

## 成功标准

团队外的一位学习者能够在 3 分钟内回答：

1. Safe、4337 Module 和 EntryPoint 分别做什么；
2. 当前哪些信息已在 Monad Testnet 真实验证；
3. 一条 UserOperation 在发送前为什么需要 Owner 确认、模拟和基础设施检查；
4. 项目当前没有做哪些高风险能力。
