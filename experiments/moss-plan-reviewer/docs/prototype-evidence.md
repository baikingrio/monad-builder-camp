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

## Monad Testnet 证明回执（独立于 Reviewer）

Moss MCP 的真实路径仍在 Monad Mainnet 上完成只读 simulation；为留下可公开核验的测试网锚点，课程 EOA 在 Monad Testnet 部署并调用了一次最小 `MossPlanHashProof` 合约：

- [部署交易](https://testnet.monadvision.com/tx/0xb8be8f389ce46ab48b63378a3bf6892fd91ec41138513a52ea4ee4e2e68618c4)
- [PlanHash 记录交易](https://testnet.monadvision.com/tx/0x04df92272152531d110a274714430a250fce3341bdaec0f3787b602ffd753557)
- [Proof 合约](https://testnet.monadvision.com/address/0xb733571fE1461161B27Bc055389b926Ddd81B1C2)

该合约把固定 `planHash`、源链 `143` 和一次 `warningCount = 0` 的记录写入 Testnet。部署与记录 receipt 均成功；`owner` / `recorder` 均为课程 EOA。合约只允许部署者记录一次，不包含任意执行入口。

这不是 Moss 在 Testnet 上的自动执行，也不让 Reviewer 获得钱包、私钥、签名或广播权限。它仅为已公开的主网 MCP simulation 建立一个独立、最小化的测试网回执。完整边界与链上状态见 [Moss MCP + RPC Evidence](./moss-mcp-rpc-evidence.md)。

## Mock 范围

本地 Reviewer 核心使用 `fixtures/` 中的 JSON 数据模拟用户意图和模拟结果。以下能力尚未接入，且不应被表述为已完成：

- Monad Testnet RPC 或测试网 simulation；
- 钱包连接、私钥、助记词或签名；
- 交易生成、发送或广播；
- 对真实资金安全或交易成功的保证。

## Known Issues / 下一步

- 当前输入是项目定义的本地 mock 结构，不是 Moss 工具的实时输出；
- Reviewer 本身没有浏览器界面、录屏、钱包、私钥、签名或 Testnet execution；独立 Testnet 合约只记录固定 PlanHash 回执，不能代替真实 MCP→钱包执行集成；
- 如果后续接入 Moss，应该只将 `action` 和 `simulate` 的公开输出映射到当前输入结构，并保持“warning 立即停止、无 warning 仍需用户确认”的规则；
- 接入真实资产前，还需要单独设计金额精度、链与资产标识、allowlist 配置、认证、审计和异常处理。
