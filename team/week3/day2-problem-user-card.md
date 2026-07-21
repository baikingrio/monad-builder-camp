# Week 3 Day 2｜Problem & User Card

## 目标用户

刚开始接触 Monad 上智能账户、Safe 或 ERC-4337 的学习者和开发者。他们已经知道账户抽象相关名词，但还没有独立完成过一条可验证的 UserOperation。

## 用户问题

用户最容易把以下三件事混为一谈：

1. Safe、Safe 4337 Module、EntryPoint 已部署在 Monad Testnet；
2. 自己已经可以创建 Safe 并发送 UserOperation；
3. Bundler、Paymaster、Owner 签名和赞助策略已经准备好。

现有资料通常分别解释合约、SDK 或 Paymaster，缺少一个把“基础设施存在”“发送前配置”和“真实链上执行”明确分层的最小学习路径。结果是学习者不知道当前自己验证了什么，也不知道下一步为什么不能直接发送操作。

## 用户场景

一位学习者准备在 Monad Testnet 实践 Safe 4337。他打开 Demo 后，希望在 3 分钟内判断：

- 三个基础组件分别负责什么；
- 哪些基础合约已在测试网真实存在；
- 一条预设 UserOperation 会包含哪些关键字段；
- 自己还缺少哪些配置、模拟和 Owner 明确确认；
- 当前 Demo 不会自动执行或动用资产。

## 唯一核心动作

> 用户打开页面，查看一个预设的 Monad Safe 4337 案例，完成三份基础合约的只读验证，并根据发送前检查清单判断该案例当前能否安全进入发送阶段。

## 成功标准

团队外的一位学习者体验后，能准确说明：

1. Safe、Safe 4337 Module、EntryPoint 的职责；
2. “链上有代码”不等于“用户操作已经可以发送”；
3. Owner 签名、模拟、Bundler 与 Paymaster 策略为何是发送前置条件；
4. 当前页面只做只读验证和预设说明，不会创建 Safe、请求签名或发送 UserOperation。

## 本周范围

### Must Have

- 一个可访问或可本地复现的 `/safe-4337-monad` 页面；
- Safe 1.4.1、Safe 4337 Module、EntryPoint v0.7 的职责与 Monad Testnet 验证链接；
- 一个预设的零 value UserOperation 学习案例及发送前检查；
- 真实链上验证、只读检查、预设/mock 与未完成能力的明确标识；
- README、自动化测试和截图或录屏证据。

### Nice to Have

- 由 Owner 明确操作、先完成模拟的零 value Monad Testnet UserOperation；
- 3–5 名学习者测试后的界面改进；
- 一段 3 分钟 Demo 录屏。

### Not This Week

- 主网、真实资产或自动执行；
- 公开 Sponsor、公开 Relayer、任意 calldata 执行；
- 收集私钥、助记词或暴露 API Key；
- 将 Safe Passkey Module 表述为 Monad Testnet 官方支持能力；
- 完整通用钱包或多协议 Agent。
