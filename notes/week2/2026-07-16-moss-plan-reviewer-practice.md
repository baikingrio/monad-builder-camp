# 从 Moss 的未签名 Plan，到一个可检查的安全审核器

## 我为什么关注 Moss

做 AI Agent × Web3 时，最容易被忽略的风险不是“模型能不能生成一笔交易”，而是生成后有没有人能看懂：它会花什么资产、给谁授权、最后会把钱或资产送到哪里。

[Moss](https://github.com/nishuzumi/moss) 尝试解决的正是这个问题。它不是帮 Agent 保管私钥或自动点击确认，而是把协议能力整理为可发现、可加载和可模拟的流程：

```text
discover → load → action → simulate → 人工核对 → 钱包确认
```

这样 Agent 不必自己拼 ABI、合约地址、calldata 和代币精度；更重要的是，用户可以在签名之前看到一个结构化的 Plan 与模拟结果。

## 我做了什么实践

我没有把 Moss 接成自动交易器，而是从其公开文档中抽出一个最小的 [Moss Plan Reviewer](../../experiments/moss-plan-reviewer/README.md)。它会检查：

- simulation 有 warning 时必须停止；
- 实际支出是否超过用户预设额度；
- approval 的 spender 是否在 allowlist 中；
- 接收方是否符合用户声明；
- 即使以上都没有问题，也仍然要求用户在钱包中确认。

这个审核器的输出只有 `STOP` 或 `REVIEW_REQUIRED`，没有“自动放行”。本地 6 个测试覆盖了 warning、未声明支出、超额支出、异常 approval、异常接收方和正常路径仍需确认等情况。

为了避免只拿 mock 数据自证，我还通过官方 Moss MCP Server 的 stdio transport 实际跑完 `discover → load → action → simulate`。该次只读流程生成了 WMON wrap 的未签名 Plan，目标链为 Monad Mainnet（Chain ID `143`），模拟结果为 `ok: true`、`warningCount: 0`。公开结果和可复跑方式见 [MCP / RPC Evidence](../../experiments/moss-plan-reviewer/docs/moss-mcp-rpc-evidence.md)。

## 一份独立的 Testnet 回执

Moss 的这条 MCP 路径不会签名或广播。我另外在 Monad Testnet 部署了一个最小的 `MossPlanHashProof` 合约，记录这次 Plan 的固定 `planHash`、源链 `143`，以及一次 `warningCount = 0` 的回执。

- [Proof 合约](https://testnet.monadvision.com/address/0xb733571fE1461161B27Bc055389b926Ddd81B1C2)
- [部署交易](https://testnet.monadvision.com/tx/0xb8be8f389ce46ab48b63378a3bf6892fd91ec41138513a52ea4ee4e2e68618c4)
- [记录交易](https://testnet.monadvision.com/tx/0x04df92272152531d110a274714430a250fce3341bdaec0f3787b602ffd753557)

这份 Testnet 回执不是 Moss 在 Testnet 上自动执行交易的证明，也不代表模拟结果保证交易成功。它只是把一份已公开、已检查的只读模拟结果留下一条可验证的链上锚点。

## 我的收获

我现在更认同：AI 在链上场景最适合做“整理能力、生成候选 Plan、解释风险”，而不是替人获得无限执行权。`warningCount = 0` 只能说明模拟结果没有发现未声明差异；它不能替代对用户真实意图、金额、授权对象和接收方的人工核对。最终签名与是否执行，仍应留在用户钱包手中。
