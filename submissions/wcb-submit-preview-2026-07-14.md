# WCB Week 2 提交预览｜2026-07-14

> 本文件用于提交前核对。所有 WCB 文案均为草稿；未调用 WCB API 提交。

## 1. Role Choice Card

- 任务 ID：`cmri43mwj7jiaph01tmdcj46p`
- 状态：`NOT_STARTED`
- Proof：

```text
我选择的主方向是 Dev Builder。

我想解决的问题是：当用户或 AI Agent 发起 Monad 链上操作时，怎样让交易不只是“能执行”，而是用户能理解、执行前能检查、关键权限边界能被验证。

我选择 Dev 的原因是，我已经在 Monad Testnet 上完成过合约开发、Foundry 测试、部署、链上交互和前端 Proof 页面，并继续学习了 ERC-4337 Sponsor 授权与 ERC-7702 EOA 委托。相比只做概念研究，我更希望把这些学习做成可运行、可验证的技术材料。

本周最小产出是：完成 Moss 开源项目学习与贡献计划，保持 ERC-4337 / ERC-7702 / ERC-1363 的公开技术 Proof，并完成一次真实 GitHub 开源协作。

进入 Week 3 团队后，我可以承担智能合约与链上交互实现、Foundry 测试、Monad Testnet 验证、交易安全边界梳理，以及前端 Proof / README 整理工作。

Proof：
https://github.com/baikingrio/monad-builder-camp/blob/main/notes/week2/2026-07-13-role-and-ai-collaboration.md
```

## 2. Week 2 Role Log

- 任务 ID：`cmri48kk47jksph015gclu8qi`
- 状态：`NOT_STARTED`
- Proof：

```text
我已建立 Week 2 Role Log，记录了 Dev Builder 的已有基础、学习资料、AI 协作方式、判断变化、遇到的问题和下一步计划。

本周我重点关注：AI 协助链上操作时，如何把用户意图、交易目标、授权额度、Gas 责任、模拟结果和最终确认拆开设计。

我阅读了 Moss 的 README、Getting Started、Agent Skill Guide、Protocol Onboarding、CONTRIBUTING，并记录了 Moss Issue #16 和 MCP Tools 的安全规则。同时保存了「Web3 技术如何从 0 到 1 用 AI 开发」和 7.13 Co-learning 的实时活动截图。

目前的判断是：模拟无 warning 不等于用户意图已经被满足，仍必须人工核对实际资产流、approval、接收方是否符合用户原本想做的事情。后续我已完成 Moss PR #19，并会继续跟进 CI 与 Maintainer Review。

Proof：
https://github.com/baikingrio/monad-builder-camp/blob/main/notes/week2/2026-07-13-role-and-ai-collaboration.md
```

## 3. AI Collaboration Log

- 任务 ID：`cmri4bgv37jmrph01plsv97wx`
- 状态：`NOT_STARTED`
- Proof：

```text
我完成了一次 AI Collaboration Log，记录了 AI 与人工判断的边界。

AI 主要帮助我梳理 Moss 的模块关系、核心流程和文档入口，辅助对照 ERC-4337 / ERC-7702 实验与“先模拟、再确认”的思路，并协助起草学习记录和开源贡献计划。

我人工完成的部分包括：逐项阅读 Moss 的 README、Getting Started、Agent Skill Guide 和 CONTRIBUTING；核对项目仍处于 alpha、未审计、只面向 Monad 主网等限制；复现 Windows `core.autocrlf=true` 下的离线测试失败；验证 `.gitattributes` 修复在新鲜检出中的完整测试、lint、build 和 typecheck 结果。

我认为不能交给 AI 的部分包括：私钥、助记词、签名、钱包交易确认、真实资产授权额度、目标合约选择、Gas 预算、安全结论和对外承诺。

Proof：
https://github.com/baikingrio/monad-builder-camp/blob/main/notes/week2/2026-07-13-role-and-ai-collaboration.md
```

## 4. Week 3 Role Statement

- 任务 ID：`cmri4e93v7jnfph016bgessi1`
- 状态：`NOT_STARTED`
- Proof：

```text
进入 Week 3 团队后，我希望承担 Dev Builder 角色，负责把团队的想法整理成可以验证的 Monad 原型。我可以承担智能合约与链上交互实现、Foundry 测试、Monad Testnet 部署和验证、前端 Proof 页面，以及把技术过程整理成 README 和演示材料。

我比较关注 AI 辅助链上操作时的安全边界：用户意图是否清楚、交易是否能模拟、授权额度和目标是否受限、最终签名是否仍由用户钱包控制。现有 Proof 包括 ERC-4337 Sponsor 授权、ERC-7702 受限 Executor、ERC-1363 质押分红的 Testnet 实践，以及为 Moss 提交的跨平台测试修复 PR。

我希望队友补充产品场景、用户研究、UI/交互或社区运营能力。合作时我可以把需求拆成合约、前端、测试和链上验证几个小步骤，先做最小闭环，再根据反馈迭代。我能提供的不是只停留在本地的代码，而是包含测试、公开链上链接和 GitHub 协作记录的 Proof of Work。

在团队协作中，我也会在功能开始前把关键假设、验收标准和风险写清楚；对每次链上交互保留可复查的交易哈希或测试记录。遇到权限不明确、模拟结果异常或需求无法验证时，我会先暂停并与队友确认，而不是为了赶进度绕过检查。

Proof：
https://github.com/baikingrio/monad-builder-camp/blob/main/notes/week2/2026-07-14-week3-role-statement.md
```

## 5. 认识一个开源项目：Moss

- 任务 ID：`cmri5cdbd7k3eph015mtpczvn`
- 状态：`NOT_STARTED`
- Proof：

```text
我学习的开源项目是 Moss：https://github.com/nishuzumi/moss

Moss 是一个面向 Monad 的 Agent 能力层。它把复杂 DApp / 协议交互整理为 discover → load → action → simulate 的统一流程，而不是让 Agent 自己拼 ABI、合约地址、calldata、精度和多笔清理操作。

它解决的问题是：Agent 手写交易调用时，可能出现“看起来差不多正确、实际上有风险”的情况。Moss 要求 Plan 先声明资金流和 approval，再通过模拟发现未声明差异；有 warning 就应该停止。

我认为它适合用户让 AI 协助完成 Monad 上代币兑换或多步骤资金操作的场景。Agent 应先生成未签名 Plan 并模拟，核对实际支出、收到的资产、approval 对象和额度后，才展示给用户钱包确认。

我的理解是，Moss 不是替用户自动交易的工具，而是把 Agent 链上操作变得更可解释、可检查的安全护栏。它不保存私钥、不签名、不广播交易；最终确认权仍在用户钱包。

Proof：
https://github.com/baikingrio/monad-builder-camp/blob/main/notes/week2/2026-07-13-moss-open-source.md
```

## 6. GitHub 探索日志

- 任务 ID：`cmri5ev497k43ph01jnifpim7`
- 状态：`NOT_STARTED`
- Proof：

```text
我对 nishuzumi/moss 完成了一次 GitHub 探索。

Moss 是 pnpm monorepo，核心目录包括 packages/core、packages/simulator、packages/erc、packages/system、packages/protocols、packages/mcp-server、examples 和 docs。它们分别负责基础语义与 Plan、交易模拟与 effects 对账、标准 ERC 接口、Monad 系统实例、协议 Adapter、MCP 工具、示例和开发文档。

我理解了 README、Docs、Issues、Pull Requests、CONTRIBUTING 和 SECURITY 的作用，并阅读了 Issue #16 的新手 Quick Start 建议和 Issue #18 的 Windows 离线测试失败报告。

我对 Issue #18 做了实际复现：在 `core.autocrlf=true` 的新鲜检出中，生成的 ABI 文件会被检出为 CRLF，而生成器输出是 LF，导致来源测试失败。之后我提交了 PR #19，用 `.gitattributes` 固定文本检出换行符，并验证离线测试、lint、build 和 typecheck 都通过。

Proof：
https://github.com/baikingrio/monad-builder-camp/blob/main/notes/week2/2026-07-13-moss-open-source.md
PR：https://github.com/nishuzumi/moss/pull/19
```

## 7. 开源贡献计划

- 任务 ID：`cmri5gv9x7k4pph01mwi1serz`
- 状态：`NOT_STARTED`
- Proof：

```text
我的 Builder 身份是 Dev Builder，主要关注 Monad 链上交互、安全边界和可验证 Proof。

我的贡献方向是优先从真实、范围小、可审查的开发者体验问题开始，而不是没有充分理解架构就新增协议 Adapter。

本周目标已经完成：我围绕 Moss Issue #18 提交了公开 PR #19，修复 Windows 用户启用 core.autocrlf 后，离线测试和格式检查被 CRLF / LF 换行符差异影响的问题。

预计产出已经落地为：一个公开 PR、完整的问题复现过程、修复说明，以及 MOSS_SKIP_E2E=1 pnpm test、pnpm lint、pnpm build、pnpm typecheck 的验证证据。

后续计划是跟进 CI 和 Maintainer Review；如果有反馈，按项目规范修改并补充验证记录。

Proof：
https://github.com/baikingrio/monad-builder-camp/blob/main/notes/week2/2026-07-13-moss-open-source.md
PR：https://github.com/nishuzumi/moss/pull/19
```

## 8. 完成第一次 GitHub 协作

- 任务 ID：`cmri5if0m7k4rph01quuxiqji`
- 状态：`NOT_STARTED`
- Proof：

```text
我完成了第一次真实 GitHub 开源协作：

PR：https://github.com/nishuzumi/moss/pull/19
GitHub：https://github.com/baikingrio

本次贡献修复了 Moss 在 Windows `core.autocrlf=true` 环境下的开发者体验问题。Kuru ABI 来源测试需要把已提交的生成文件与生成器输出严格比较，但 Git 会把工作区文本检出为 CRLF，而生成器输出保持 LF，导致内容相同却测试失败。

我先在新鲜检出环境中复现 Issue #18，再提交 `.gitattributes` 固定文本文件以 LF 检出。修复后，在模拟 Windows 换行环境中验证：MOSS_SKIP_E2E=1 pnpm test、pnpm lint、pnpm build、pnpm typecheck 均通过。
```

## 9. 留下属于自己的 Proof of Work

- 任务 ID：`cmri5kxy67k67ph0191frpsbb`
- 状态：`NOT_STARTED`
- Proof：

```text
我留下的公开 Proof of Work 是 Moss PR #19：
https://github.com/nishuzumi/moss/pull/19

这是一次真实的跨平台开发者体验修复。我复现了 Windows `core.autocrlf=true` 导致离线测试失败的问题，定位到 Git 检出时的 CRLF / LF 差异会破坏 ABI 生成文件的来源校验，并提交 `.gitattributes` 让文本文件稳定以 LF 检出。

PR 描述中包含问题背景、修复范围和验证方式。修复已经在模拟 Windows 换行环境中通过离线测试、lint、build 和 typecheck 验证。PR 当前为 Open 状态，仍在等待上游 CI 与 Maintainer Review；本任务不以 Merge 为前提。
```

## 不在本次提交范围内

- Moss 介绍文章：现有材料是学习笔记，尚未整理成独立公开文章；
- Moss 新手教程：尚未形成面向新手的步骤式教程；
- Moss 第一个 PR：已完成 PR #19，可单独提交，但本预览优先覆盖“第一次 GitHub 协作”和“Proof of Work”。

## 隐私检查

本文案未写入任何敏感配置、私钥、助记词或未公开会议链接。
