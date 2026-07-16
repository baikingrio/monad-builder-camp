# WCB 提交草稿｜Week 2｜Prototype Evidence

- 任务 ID：`cmri54sws7k1kph0107p9x4ox`
- Track ID：`cmr9aw9vjr4irph01r5pr2qx5`
- 当前状态：`NOT_STARTED`（可提交）
- 本文件是提交前草稿，**尚未提交到 WCB**。

## 可直接提交的 Proof

原型 README：
https://github.com/baikingrio/monad-builder-camp/tree/main/experiments/moss-plan-reviewer

Prototype Evidence：
https://github.com/baikingrio/monad-builder-camp/blob/main/experiments/moss-plan-reviewer/docs/prototype-evidence.md

MCP / RPC 与安全边界说明：
https://github.com/baikingrio/monad-builder-camp/blob/main/experiments/moss-plan-reviewer/docs/moss-mcp-rpc-evidence.md

本次原型是 Moss Plan Reviewer：根据用户声明的意图检查模拟结果，出现 warning 时停止；即使无 warning，也继续核对支出、approval spender 和接收方，并要求用户最终在钱包确认。它不保存私钥、不连接钱包、不自动签名或广播。

可检查结果：
- 官方 Moss MCP Server 通过 stdio 完成 `discover → load → action → simulate`；主网只读模拟结果为 `ok: true`、`warningCount: 0`，生成的未签名 PlanHash 是 `0xd79ace0ec5ac5e8f53b8a5ea96d500db16e405c40c82d8e190fd39ac25915fcf`。
- Reviewer 本地测试：`npm test`，6 passed。
- 独立 Monad Testnet Proof 合约：
  https://testnet.monadvision.com/address/0xb733571fE1461161B27Bc055389b926Ddd81B1C2
- Testnet 部署交易：
  https://testnet.monadvision.com/tx/0xb8be8f389ce46ab48b63378a3bf6892fd91ec41138513a52ea4ee4e2e68618c4
- Testnet PlanHash 记录交易：
  https://testnet.monadvision.com/tx/0x04df92272152531d110a274714430a250fce3341bdaec0f3787b602ffd753557
- Foundry 测试：`forge test`，47 passed。

边界说明：Moss MCP 路径是 Monad Mainnet 的只读模拟；Testnet 合约仅记录固定 PlanHash、源链 ID 与零 warning 回执，不代表 Moss 在 Testnet 自动执行、签名或广播了交易。Reviewer 的 fixture 仍是本地 mock 数据，真实资产执行、浏览器 UI、钱包签名与自动交易均未接入。
