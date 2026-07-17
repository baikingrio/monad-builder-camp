# Week 2｜Moss 学习笔记、GitHub 探索与开源贡献计划

日期：2026-07-13
项目：[nishuzumi/moss](https://github.com/nishuzumi/moss)

## 一、Moss 是什么

Moss 是一个面向 Monad 的 Agent 能力层。它把复杂 DApp / 协议交互整理为统一、可被 Agent 调用的能力，而不是让 Agent 自己拼 ABI、合约地址、calldata、精度和多笔清理操作。

它的标准流程是：

```text
discover → load → action → simulate → 人工核对 → 钱包确认
```

- `discover`：查找可以完成某类用户意图的 Capability 或 Query；
- `load`：读取能力的参数类型、字段说明、风险标签和调用约束；
- `action`：查询直接返回数据；写操作构建由直接未签名交易组成的 Capability Tree；
- `simulate`：在链上当前状态上模拟执行，从有序 Change 中生成 typed Receipt 和 warning；
- 人工核对：将 Receipt、warning 与用户原始意图对照后，才可能交给钱包确认。

Moss 不保存私钥、不签名、不广播交易。最后的签名和确认仍在用户钱包里完成。

## 二、它解决了什么问题

一个看似简单的 DEX 兑换，实际可能涉及路由地址、exact-in / exact-out、原生币包装和解包、退款/清理调用、代币精度和滑点。让 Agent 直接根据 ABI 拼交易，很容易出现“差一点正确”的调用，而资金场景里这正是风险。

Moss 的重点不是让 Agent 拥有更多交易权限，而是把协议交互封装为带语义和安全约束的能力：

1. Agent 用人类可读的参数表达意图，而非手写 calldata；
2. 每个 Protocol 把可执行操作定义为 Capability，并显式说明参数、风险和依赖；
3. 写操作生成由直接未签名交易组成的 Capability Tree；
4. 模拟从真实链上执行轨迹提取有序 Change，并由 typed Receipt 完整解释资产流、授权和接收方；
5. 出现 warning 时必须停止并排查；即使没有 warning，用户或上层 Agent 仍要核对结果是否符合原始意图。

这和我在 Monad Testnet 做 ERC-4337 Sponsor 和 ERC-7702 受限 Executor 时的体会一致：能执行不等于应当执行。权限、目标、额度、Gas 责任和确认步骤都需要独立约束。

## 三、一个我认为适合的应用场景

我认为 Moss 很适合“用户让 AI 协助完成 Monad 上的代币兑换或多步骤资金操作”这个场景。

例如用户说“把一部分 MON 换成 USDC，再把得到的 USDC 用于后续操作”。Agent 不能直接根据自然语言构造交易；它应该先发现可用能力、读取参数和风险、生成未签名 Plan，然后把多步操作按顺序一起模拟。只有模拟结果没有 warning，并且实际支出、收到的资产、approval 的对象和额度都与用户意图一致，才可以把摘要展示给用户钱包确认。

但这不表示可以完全自动化：README 明确说明 Moss 仍是 alpha、未审计；模拟结果只反映模拟时的链上状态，价格、流动性和合约状态仍可能在签名之前变化。因此它更像交易前的验证护栏，而不是交易成功保证。

## 四、GitHub Exploration Log

### 项目目录与模块分工

Moss 是 pnpm monorepo，核心目录包括：

- `packages/core`：不包含链上地址或 ABI 的基础设施，负责注册表、Plan 和语义；
- `packages/simulator`：通过 `debug_traceCall` 模拟并提取实际效果，再与 `expects` 对账；
- `packages/erc`：ERC-20 / ERC-721 等通用接口能力；
- `packages/system`：Monad 运行时、代币资料以及 WMON 等系统实例；
- `packages/protocols/*`：一协议一包的协议 Adapter，当前包含 Kuru，另有 `_template`；
- `packages/mcp-server`：通过 stdio 暴露 `discover`、`load`、`action`、`simulate` 四个 MCP 工具；
- `examples/`：简单流程与 agent swap 示例；
- `docs/`：入门、MCP 工具、Agent 规则、协议接入和 ADR。

### GitHub 各模块的作用

- **README**：解释定位、风险模型、快速开始和已支持能力；
- **Docs**：把新手上手、工具契约、Agent 的停止规则、协议接入标准拆开说明；
- **Issues**：记录待支持的协议、接口设计和文档改进方向；
- **Pull Requests**：用于提交可审查的协作改动；
- **CONTRIBUTING**：规定环境、测试、PR 证据和 Adapter 的完成标准；
- **SECURITY**：说明安全边界及安全问题的反馈方式。

### 我关注的 Issue

我关注 [Issue #16：Documentation Improvement: Add a Beginner-friendly Quick Start Guide](https://github.com/nishuzumi/moss/issues/16)。这个 Issue 提出补充一步一步的安装说明、最小环境要求、Hello World、常见配置链接和 FAQ。

项目其实已经有 `docs/getting-started.md`，其中包括 Node ≥ 22、pnpm、`pnpm install`、`pnpm build` 和第一个 `wrap` 示例。因此我不会直接重复提交同样的内容。更合理的后续做法是先比较 README 与 Getting Started 的衔接：新用户是否能快速知道应该从哪一份文档开始、失败时应该检查什么、哪些操作只会模拟而不会签名。确认真正缺口后，再提出精确的文档建议或小型 PR。

### 学习收获

我以前更多从合约和前端的角度理解“交易安全”，这次更清楚地看到 Agent 层也需要可验证的中间产物。Plan 的 `expects` 把“我预计付出/收到什么”写成机器可检查的约束，模拟再把真实效果拿来对账。它不能代替用户意图判断，但能减少 Agent 自己拼交易时的隐藏偏差。

## 五、Open Source Contribution Plan

### Builder 身份

Dev Builder，侧重 Monad 链上交互、安全边界和可验证 Proof。

### 贡献方向

优先从文档 / 新手体验开始，而不是直接开发新的协议 Adapter。

原因是新增 Adapter 需要验证地址和 ABI 来源、声明能力/风险/`expects`、添加链上模拟测试、准备效果摘要并通过完整 CI。当前更适合先把已有工具读透，再做范围清楚、可审查的小贡献。

### 本周目标与实际进展

我的贡献计划是优先从真实、范围小、可审查的开发者体验问题开始。这个目标已完成：我为 [Issue #18](https://github.com/nishuzumi/moss/issues/18) 提交了 [PR #19](https://github.com/nishuzumi/moss/pull/19)，并已由 Maintainer `nishuzumi` 于 2026-07-14 合并到 Moss `main`。

这个 Issue 是 Windows 用户在 `core.autocrlf=true` 环境运行离线测试时，Kuru ABI 来源测试因 CRLF / LF 换行符差异失败。我的 PR 新增 `.gitattributes`，让 Git 将文本文件以 LF 检出，从而同时稳定生成文件来源测试和 Biome 格式检查。

我先在模拟 Windows 换行环境中复现问题，再在新鲜检出中验证：`MOSS_SKIP_E2E=1 pnpm test`、`pnpm lint`、`pnpm build`、`pnpm typecheck` 都通过。合并提交为 [`94adfea`](https://github.com/nishuzumi/moss/commit/94adfeade9c92176cd3163abad20ae64f6a7b19a)。

### 实际产出

- [已合并 Pull Request #19](https://github.com/nishuzumi/moss/pull/19)；
- Issue 背景、修复范围与验证证据均已写入 PR 描述；
- [合并提交 94adfea](https://github.com/nishuzumi/moss/commit/94adfeade9c92176cd3163abad20ae64f6a7b19a)；
- 该 PR 可作为第一次 GitHub 协作和 Proof of Work 的公开证据。

### 后续贡献计划

1. 持续阅读 README、Getting Started、CONTRIBUTING、当前 ADR 与 Protocol Onboarding；
2. 对新的贡献方向先确认不重复现有 PR，也不把旧架构重新引入当前 `main`；
3. 当前重点研究 ERC-4626 #13：先确认最小可贡献切片，再按项目规范准备设计、测试和验证证据；
4. 后续 PR 继续遵循 `main` 分支、清晰说明动机 / 范围 / 验证证据等贡献规范；
5. 记录公开链接，作为“第一次 GitHub 协作”和“Proof of Work”的共同证据。

## 资料链接

- [Moss README](https://github.com/nishuzumi/moss)
- [Getting Started](https://github.com/nishuzumi/moss/blob/main/docs/getting-started.md)
- [Agent Skill Guide](https://github.com/nishuzumi/moss/blob/main/docs/agent-skill.md)
- [Protocol Onboarding](https://github.com/nishuzumi/moss/blob/main/docs/protocol-onboarding.md)
- [Contributing](https://github.com/nishuzumi/moss/blob/main/CONTRIBUTING.md)
- [Issue #16](https://github.com/nishuzumi/moss/issues/16)
