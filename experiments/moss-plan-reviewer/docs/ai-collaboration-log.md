# AI Collaboration Log｜Moss Plan Reviewer

## 我让 AI 协助的内容

我让 AI 根据 Moss README、Agent Skill Guide 和 MCP Tools Reference，整理 `discover → load → action → simulate` 的流程，并把“模拟后的人工核对”拆成可测试的最小模块。

AI 的初版建议包括：

- 用 `intent` 描述用户允许的最大支出、approval spender 和接收方；
- 用 `simulation.effects` 记录模拟得到的支出、approval 和接收结果；
- 有 warning 时停止；
- 用测试 fixture 验证异常和正常输入。

## 我人工确认与修改的内容

1. 我回到 Moss 文档核对：`action` 生成的是未签名 Plan，模拟 warning 不能忽略，模拟无 warning 也不能替代意图核对和用户确认。
2. 我删除了“审核通过后自动执行”的方向。这个骨架只允许输出 `STOP` 或 `REVIEW_REQUIRED`，没有 `ALLOW`、签名、钱包连接或广播交易的能力。
3. 我把检查拆成四类独立的可测试规则：未声明/超额支出、approval spender、接收方，以及最终用户确认。
4. 我用本地 fixture 和 Node 内置测试验证了 warning、未声明支出、超额支出、未知 spender、未知接收方以及无异常 effects 这六种情况。
5. 我明确将所有 fixture 标为 mock，不把本地模拟结果表述成真实链上执行或交易成功保证。

## 不能交给 AI 的判断

- 用户真实想支付什么、最多支付多少；
- approval 的具体额度和 spender 是否真的合理；
- 钱包签名、私钥、助记词和真实交易确认；
- 对真实资金风险、安全性或交易结果的最终承诺。

## 下一步

如果要接入真实 Moss 工具，下一步应只把 `action` 和 `simulate` 的公开输出映射到本项目的输入结构，并保留当前“任何 warning 停止、无 warning 仍需人工确认”的边界；不把审核器变成自动交易器。
