# Week 2｜Dev Portfolio Pack：Moss Plan Reviewer

## 1. 我想解决什么问题

我在 Week 2 选择 Dev Builder 方向，完成了一个最小的 **Moss Plan Reviewer**。

它面向“AI Agent 已生成未签名 Plan 和模拟结果”的场景：用户先声明最多支出多少、可接受哪些 approval spender 和接收方；Reviewer 再检查模拟结果是否越过这些边界。

它只输出 `STOP` 或 `REVIEW_REQUIRED`，不会签名、发送或自动放行交易。即使模拟没有 warning，最终确认权仍在用户的钱包里。

这份练习基于 Moss 的公开流程：

```text
discover → load → action → simulate → 人工核对 → 钱包确认
```

- [Moss README](https://github.com/nishuzumi/moss)
- [Moss Agent Skill Guide](https://github.com/nishuzumi/moss/blob/main/docs/agent-skill.md)
- [Moss MCP Tools Reference](https://github.com/nishuzumi/moss/blob/main/docs/mcp-tools.md)

## 2. Dev Plan 与真实实现范围

用户完成的最小动作是：把自己的支付意图和 Agent 的模拟结果交给 Reviewer，查看是否存在 warning、超额支出、未知 approval spender 或未知接收方。

本周真实完成的代码范围：

- `src/reviewer.mjs`：检查意图与模拟 effects；
- `fixtures/`：本地 mock Plan、意图和模拟结果；
- `test/reviewer.test.mjs`：覆盖 warning、未声明支出、超额支出、未知 spender、未知接收方，以及正常 effects 仍需用户确认；
- `README.md`：说明规则、运行方式和 mock 边界；
- `docs/ai-collaboration-log.md`：记录 AI 协助和人工判断。

代码与 README：

- [Moss Plan Reviewer](https://github.com/baikingrio/monad-builder-camp/tree/main/experiments/moss-plan-reviewer)
- [原型 README](https://github.com/baikingrio/monad-builder-camp/blob/main/experiments/moss-plan-reviewer/README.md)

## 3. 运行与验证证据

本地 Reviewer 可以在 Node.js 环境中运行：

```bash
cd experiments/moss-plan-reviewer
npm test
```

公开记录中的最近验证结果为 `6 passed, 0 failed`。

除了本地 fixture，我还通过官方 Moss MCP Server 的 stdio transport 跑通了 `discover → load → action → simulate`。这条路径在 Monad Mainnet 上只读模拟，生成的是未签名 Plan；`ok: true` 和 `warningCount: 0` 不代表可以跳过意图核对或钱包确认。

- [Prototype Evidence：测试结果、MCP/RPC 证据与边界](https://github.com/baikingrio/monad-builder-camp/blob/main/experiments/moss-plan-reviewer/docs/prototype-evidence.md)
- [MCP / RPC Evidence](https://github.com/baikingrio/monad-builder-camp/blob/main/experiments/moss-plan-reviewer/docs/moss-mcp-rpc-evidence.md)

为给这份只读模拟建立独立、最小化的测试网锚点，我部署并调用了 `MossPlanHashProof`。它只记录固定 PlanHash、源链 ID 和零 warning 回执，不调用 Moss，也没有任何签名或自动执行入口。

- [Testnet Proof 合约](https://testnet.monadvision.com/address/0xb733571fE1461161B27Bc055389b926Ddd81B1C2)
- [部署交易](https://testnet.monadvision.com/tx/0xb8be8f389ce46ab48b63378a3bf6892fd91ec41138513a52ea4ee4e2e68618c4)
- [PlanHash 记录交易](https://testnet.monadvision.com/tx/0x04df92272152531d110a274714430a250fce3341bdaec0f3787b602ffd753557)

## 4. AI Collaboration 与人工判断

AI 协助我把 Moss 文档中的流程整理成可测试的最小结构，并协助生成初版规则和 fixture。

我人工完成的关键判断是：

- 删除“审核通过后自动执行”的方向；
- 明确无 warning 不等于安全放行；
- 将支出、approval、接收方和最终确认拆成独立检查；
- 将 fixture 明确标记为 mock，不表述为真实链上执行；
- 不把私钥、签名、真实资金风险和最终确认交给 AI。

详细记录：

- [AI Collaboration Log](https://github.com/baikingrio/monad-builder-camp/blob/main/experiments/moss-plan-reviewer/docs/ai-collaboration-log.md)

## 5. Known Issues / 当前边界

当前项目不是自动交易器，也不是完整的钱包应用：

- Reviewer 核心输入仍是项目定义的本地 mock 结构，不是 Moss 工具的实时输出；
- 没有浏览器 UI、钱包连接、私钥、签名或交易广播；
- Testnet 合约只记录 PlanHash 回执，不能替代 MCP 到钱包执行的真实集成；
- 如果未来接入真实资产，还需要单独处理金额精度、资产和链标识、allowlist 配置、认证、审计与异常处理。

完整边界与后续方向：

- [Prototype Evidence 的 Known Issues](https://github.com/baikingrio/monad-builder-camp/blob/main/experiments/moss-plan-reviewer/docs/prototype-evidence.md#known-issues--%E4%B8%8B%E4%B8%80%E6%AD%A5)

## 6. Week 3 我能继续承担的角色

进入 Week 3 团队后，我希望继续承担 Dev Builder：把想法拆成能验证的 Monad 原型，并负责智能合约与链上交互实现、Foundry 测试、Monad Testnet 部署和验证、前端 Proof 页面，以及 README 和演示材料整理。

在 AI 辅助链上操作的项目中，我会特别关注用户意图、模拟结果、授权范围和最终钱包确认之间的安全边界。

- [Week 3 Role Statement｜Dev Builder](https://github.com/baikingrio/monad-builder-camp/blob/main/notes/week2/2026-07-14-week3-role-statement.md)

## 7. 一句话总结

这周我完成的不是一个会自动替用户交易的 Agent，而是一个把“先模拟、再核对、最后由用户确认”写成可运行、可测试、可复查规则的最小原型。
