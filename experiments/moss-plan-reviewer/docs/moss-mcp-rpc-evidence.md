# Moss MCP + RPC Evidence

## 目的

这份记录证明 `Moss Plan Reviewer` 不只使用本地 fixture：项目中的证据脚本会通过 **官方 Moss MCP Server 的 stdio transport** 调用 `discover → load → action → simulate`，并由 Moss 使用 Monad Mainnet RPC 做真实链上状态模拟。

这是一条**只读模拟路径**。Moss 的 MCP Server 不签名、不广播；本项目的脚本也不读取私钥或钱包配置。

## 运行条件

官方 Moss 当前默认运行在 Monad Mainnet：

- Chain ID：`143`
- 默认 RPC：`https://rpc.monad.xyz`
- simulation 依赖支持 `debug_traceCall` 的 RPC

在独立目录准备官方源码：

```bash
git clone https://github.com/nishuzumi/moss
cd moss
pnpm install --frozen-lockfile
pnpm build
```

然后在本项目中运行：

```bash
cd experiments/moss-plan-reviewer
MOSS_SOURCE_DIR=/absolute/path/to/moss node scripts/run-moss-mcp-evidence.mjs
```

可选环境变量：

- `MOSS_EVIDENCE_RPC_URL`：覆盖默认主网 RPC；
- `MOSS_EVIDENCE_CHAIN_ID`：覆盖默认 `143`；
- `MOSS_EVIDENCE_ACCOUNT`：仅作为 Plan 的模拟 sender，默认使用无私钥的示例地址。

## 已验证流程

本次实际启动官方 `moss-mcp`，并通过 MCP client 调用：

1. `discover({ verb: "wrap" })`：发现 `wmon.wrap` capability；
2. `load([{ protocol: "wmon", method: "wrap" }])`：读取调用语义与风险信息；
3. `action(...)`：为 `0.001 MON` 生成一个未签名 Plan；
4. `simulate([plan])`：通过主网 RPC 模拟，并检查 effects / warnings。

结果见 [moss-mcp-mainnet-result.json](./moss-mcp-mainnet-result.json)：

- MCP server 暴露 `action`、`discover`、`load`、`simulate` 四个工具；
- 生成的 Plan 目标链为 `143`，且包含 `planHash`；
- simulation 返回 `ok: true`、`warningCount: 0`；
- 该结果只表示 Plan 与模拟结果一致，仍需要根据用户真实意图进行人工核对。

## Monad Testnet 证明回执（独立路径）

为让这次已经完成的主网只读模拟具有可公开核验的链上锚点，课程 EOA 在 **Monad Testnet（Chain ID `10143`）** 部署了一个最小 `MossPlanHashProof` 合约，并只执行一次 `recordZeroWarningPlan()`。

- Proof 合约：[0xb733…B1C2](https://testnet.monadvision.com/address/0xb733571fE1461161B27Bc055389b926Ddd81B1C2)
- 部署交易：[0xb8be…18c4](https://testnet.monadvision.com/tx/0xb8be8f389ce46ab48b63378a3bf6892fd91ec41138513a52ea4ee4e2e68618c4)
- 记录交易：[0x04df…3557](https://testnet.monadvision.com/tx/0x04df92272152531d110a274714430a250fce3341bdaec0f3787b602ffd753557)

链上已独立核验：两个 receipt 的 `status` 均为 `1`；合约的 `planHash` 为 `0xd79ace0ec5ac5e8f53b8a5ea96d500db16e405c40c82d8e190fd39ac25915fcf`，`sourceChainId` 为 `143`，`recorded = true`，且 `owner` 与 `recorder` 都是课程 EOA `0x7c0343c808B827e4286381c2292d92c3f19152a4`。记录事件的 `warningCount` 为 `0`。

这份 Testnet Proof 是一个**固定 PlanHash 的可验证回执**：合约只允许部署者记录一次，不接收私钥、不调用 MCP、不验证模拟，也不具备执行、签名或广播任意交易的能力。它不能证明 Moss 在 Testnet 上执行过该 Plan，更不能把主网 simulation 说成 Testnet 交易。

合约源码、部署脚本与测试位于：

- `experiments/monad-playground/src/MossPlanHashProof.sol`
- `experiments/monad-playground/script/DeployMossPlanHashProof.s.sol`
- `experiments/monad-playground/test/MossPlanHashProof.t.sol`

## 与本地 Reviewer 的关系

本地 `reviewPlan` 保持纯函数和离线 fixture 测试；它不会因为连接到 MCP 就获得自动执行权。

后续集成应只将 Moss `action` 与 `simulate` 的公开输出映射为 Reviewer 输入，并继续执行以下规则：

- 任意 warning：`STOP`；
- 无 warning：仍然对照用户意图、金额、approval 和接收方；
- 最终签名与广播必须由用户单独确认。

## 当前限制

- 官方 Moss 当前主要配置 Monad Mainnet（Chain ID `143`），本次 MCP/RPC 证据不是 Monad Testnet 交易；
- 该路径是 simulation，不会产生交易 hash；
- 如需 Monad Testnet 交易，应使用独立的、最小权限的测试网执行证明，并明确标注它不是 Moss 自动执行。
