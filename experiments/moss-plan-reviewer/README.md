# Moss Plan Reviewer

一个根据 Moss 文档安全流程写出的最小代码骨架。它只审核已经产生的模拟结果，不连接钱包、不保存私钥、不签名，也不广播交易。

## 为什么做这个

Moss 将 Agent 链上交互拆为：

```text
discover → load → action → simulate → 人工核对 → 钱包确认
```

这个练习将其中“模拟后的人类可读审核”抽成一个最小模块。输入是用户声明的意图和模拟结果；输出只能是 `STOP` 或 `REVIEW_REQUIRED`，不会输出自动放行或自动执行。

## 当前骨架做什么

`src/reviewer.mjs` 的 `reviewPlan` 会：

1. 模拟有任何 warning 时返回 `STOP`；
2. 检查模拟支出是否已在用户意图中声明且不超过最大额度；
3. 检查 approval spender 是否在声明的 allowlist 内；
4. 检查接收方是否在声明的 allowlist 内；
5. 即使以上全部通过，也返回 `REVIEW_REQUIRED`，要求用户在钱包中完成最终确认。

## 不做什么

- 不调用 Moss MCP Server 或任何 RPC；
- 不生成交易、签名或发送交易；
- 不读取私钥、助记词、钱包或环境变量；
- 不把模拟结果写成交易成功保证。

因此 `fixtures/` 中的 Plan 和模拟结果均为本地 mock 数据，只用于验证审核逻辑。

## 运行

需要 Node.js 22 或兼容 Node 内置测试运行器的版本：

```bash
npm test
```

当前测试覆盖：

- simulation warning 必须停止；
- 未声明或超过上限的支出需要复核；
- 未声明 approval spender 时需要复核；
- 未声明接收方时需要复核；
- 即使 effects 匹配意图，仍必须用户确认。

## 文档到代码的对应关系

| 文档安全规则 | 本骨架中的实现 |
| --- | --- |
| `action` 只生成未签名 Plan | 本项目不包含签名或广播代码 |
| 有 warning 必须停止 | `SIMULATION_WARNING` → `STOP` |
| 对照实际 effects 与意图 | 支出、approval、接收方检查 |
| 无 warning 仍需核对与确认 | 固定返回 `USER_CONFIRMATION_REQUIRED` |

## AI 协作与人工修改

完整记录见 [docs/ai-collaboration-log.md](./docs/ai-collaboration-log.md)。

人工修改的关键原则是：不因为模拟没有 warning 就自动放行，也不将 Plan Reviewer 扩展为钱包或交易执行器。

## Prototype Evidence 与 Known Issues

可检查的运行方式、当前完成范围、mock 边界与后续限制见 [Prototype Evidence](./docs/prototype-evidence.md)。

当前没有接入 Moss MCP、RPC、钱包或真实链上模拟；它也没有浏览器界面、录屏或测试网交易。后续若接入真实工具，只应映射公开的 `action` / `simulate` 输出，不能把审核器扩展成自动签名或自动交易器。

## 参考文档

- [Moss README](https://github.com/nishuzumi/moss)
- [Moss Agent Skill Guide](https://github.com/nishuzumi/moss/blob/main/docs/agent-skill.md)
- [Moss MCP Tools Reference](https://github.com/nishuzumi/moss/blob/main/docs/mcp-tools.md)
