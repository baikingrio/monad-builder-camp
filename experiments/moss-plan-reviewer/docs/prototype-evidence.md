# Prototype Evidence｜Moss Plan Reviewer

## 一句话介绍

Moss Plan Reviewer 是一个根据用户声明的意图，核对 Agent 模拟结果的本地最小审核器。它只会给出 `STOP` 或 `REVIEW_REQUIRED`，不会签名、广播或自动放行交易。

## 公开代码与查看入口

- 代码目录：<https://github.com/baikingrio/monad-builder-camp/tree/main/experiments/moss-plan-reviewer>
- 使用说明与规则映射：[README](../README.md)
- AI 协助与人工核查：[AI Collaboration Log](./ai-collaboration-log.md)
- 参考项目：<https://github.com/nishuzumi/moss>

## 当前完成内容

`src/reviewer.mjs` 已实现以下审核规则：

1. 模拟结果存在 warning 时，返回 `STOP`；
2. 模拟支出未在意图中声明，或超过声明上限时，要求复核；
3. approval spender 不在 allowlist 内时，要求复核；
4. 接收方不在 allowlist 内时，要求复核；
5. 即使所有 effects 都与意图匹配，仍固定要求用户在钱包中确认。

测试位于 `test/reviewer.test.mjs`，覆盖上述五类规则及正常 effects 仍需最终确认的情况，共 6 个测试。

## 如何运行与检查

前提：Node.js 22，或兼容 Node 内置测试运行器的版本。

```bash
cd experiments/moss-plan-reviewer
npm test
```

本次 Evidence 整理前重新执行结果：

```text
# tests 6
# pass 6
# fail 0
```

## MCP / RPC Evidence

除本地 fixture 外，项目还通过官方 Moss MCP Server 的 stdio transport 完成了 `discover → load → action → simulate`，并用 Monad Mainnet RPC 进行了真实状态模拟。可复跑脚本、公开结果与限制见 [Moss MCP + RPC Evidence](./moss-mcp-rpc-evidence.md)。

该路径生成的是未签名 Plan：`simulation.ok = true`、`warningCount = 0` 只说明 Plan 与模拟 effects 一致，仍不代表可以跳过用户意图核对或钱包确认。

## Mock 范围

本地 Reviewer 核心使用 `fixtures/` 中的 JSON 数据模拟用户意图和模拟结果。以下能力尚未接入，且不应被表述为已完成：

- Monad Testnet RPC 或测试网 simulation；
- 钱包连接、私钥、助记词或签名；
- 交易生成、发送或广播；
- 对真实资金安全或交易成功的保证。

## Known Issues / 下一步

- 当前输入是项目定义的本地 mock 结构，不是 Moss 工具的实时输出；
- 当前没有浏览器界面、录屏或测试网交易，因为该模块的目标是离线审核逻辑，而不是交易执行；
- 如果后续接入 Moss，应该只将 `action` 和 `simulate` 的公开输出映射到当前输入结构，并保持“warning 立即停止、无 warning 仍需用户确认”的规则；
- 接入真实资产前，还需要单独设计金额精度、链与资产标识、allowlist 配置、认证、审计和异常处理。
