# ERC-4337 真实上链执行方案

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**目标：** 将 `experiments/erc4337-frontend` 从本地流程模拟升级为 Monad Testnet 上真实的 ERC-4337 操作入口，覆盖 `initCode`、受后端风控保护的 Paymaster 赞助与 Session Key 签到。

**架构：** 浏览器只连接用户 EOA、展示待签名内容并向受限后端提交已签名 UserOperation；后端保管赞助方私钥、签发短时赞助授权并作为 Bundler 调用 EntryPoint。合约仅接受后端签名的、已过期检查且与 UserOperation 内容绑定的赞助授权。Session Key 私钥只在用户浏览器本地生成和保存，链上权限限定在指定签到合约与函数。

**技术栈：** Solidity 0.8.28 / Foundry、Vue 3 / TypeScript / Viem / Wagmi Core、Node.js 服务、Monad Testnet、Cloudflare Tunnel 或 Nginx HTTPS。

---

## 信任与安全边界

- 仅支持 **Monad Testnet（Chain ID 10143）**，前端在签名前显式检查网络。
- 浏览器不接触赞助方私钥、Paymaster owner 私钥或服务器 API 密钥。
- `.env` 只留在 Hermes 主机。公开仓库只提交 `.env.example`，绝不提交密钥、签名授权、broadcast/cache 或运行日志。
- Sponsor API 只对允许的动作签名：工厂部署/账户初始化、指定签到目标的 `checkIn(string)`；设置短时失效、按地址与 IP 限流、每日额度和总 deposit 低水位保护。
- Paymaster 在链上验证 sponsor 签名、有效期、sender、nonce、initCode 和 callData 摘要，不能接受泛用的公开赞助请求。
- Session Key 在浏览器内生成，仅存 sessionStorage；合约强制 target、selector、到期日和 `nativeSpendLimit = 0`。
- 这是学习版实验，不能用于主网或真实资产。

## 目录结构

```text
experiments/
├── monad-playground/
│   ├── src/
│   │   ├── CampaignSponsoredPaymaster.sol
│   │   └── SessionKeyAccountFactory.sol
│   ├── script/DeployReal4337Demo.s.sol
│   └── test/
│       ├── CampaignSponsoredPaymaster.t.sol
│       └── SessionKeyAccountFactory.t.sol
└── erc4337-frontend/
    ├── server/
    │   ├── src/app.ts
    │   ├── src/policy.ts
    │   └── src/relay.ts
    ├── src/lib/
    │   ├── realExecution.ts
    │   └── api.ts
    └── .env.example
```

## 真实操作数据流

1. 前端连接用户 EOA，读取 `owner`、EntryPoint nonce 与 counterfactual 地址。
2. 前端构造限定动作的 UserOperation；用户通过钱包签署 UserOperation hash。
3. 前端向后端请求 sponsor authorization，不传私钥。
4. 后端校验请求策略、频率和用户签名，签发短时授权。
5. 前端带授权重新构造 UserOperation 并提交后端 relay endpoint。
6. 后端再次校验操作、调用 EntryPoint `handleOps`，并返回交易 hash。
7. 前端轮询 receipt、EntryPoint nonce、账户/签到状态并展示 MonadVision proof。

## 任务拆解

### Task 1：受限 Paymaster 合约

**文件：** `experiments/monad-playground/src/CampaignSponsoredPaymaster.sol`、对应 Foundry 测试。

1. 写失败测试：无效 sponsor 签名、过期授权、callData 被替换时必须拒绝。
2. 实现授权 hash：绑定 `sender`、`nonce`、`initCode` hash、`callData` hash、`validUntil`。
3. 实现只允许 EntryPoint 调用、只允许已签名授权、只允许有效期内操作的 `validatePaymasterUserOp`。
4. 运行 `forge test`。

### Task 2：Session Key Factory 与目标部署

**文件：** `SessionKeyAccountFactory.sol`、对应测试与部署脚本。

1. 写失败测试：预测地址与部署地址一致；重复 create 不重复部署。
2. 实现 CREATE2 factory，部署 `MinimalSessionKeyAccount`。
3. 运行 `forge test`。

### Task 3：Relay API

**文件：** `experiments/erc4337-frontend/server/`。

1. 写失败测试：错误 chain、未允许 callData、过期请求、额度超限必须返回 4xx。
2. 实现 `/health`、`/v1/sponsor`、`/v1/relay`，使用服务器环境变量建立 Viem public/wallet client。
3. 后端重新验证 UserOperation 和 sponsor authorization 后才调用 `handleOps`。
4. 运行服务单测。

### Task 4：真实前端流程

**文件：** `src/lib/realExecution.ts`、`src/App.vue`、Vitest 测试。

1. 写失败测试：未在 Monad Testnet、没有 API URL、没有用户签名时禁止提交。
2. 用 Viem 编码 UserOperation、`initCode`、`callData`、签名和 relay request。
3. 替换“模拟上链”按钮为“签名并提交到 Monad Testnet”，展示明确的测试网提示、钱包确认与交易 hash。
4. 运行 `npm test && npm run build`。

### Task 5：部署和验收

1. `forge build && forge test`。
2. 使用课程测试账户 dry-run 部署脚本，再 `--broadcast` 部署并为 Paymaster 充值一个小的测试网额度。
3. 验证 receipt、EntryPoint nonce、合约 code、Paymaster deposit、签到计数。
4. 将 API 仅绑定 `127.0.0.1`，用 Cloudflare Tunnel 或 Nginx HTTPS 仅暴露 `/health` 和 `/v1/*`。
5. 前端配置公开 API base URL，不暴露服务端密钥。
6. 提交源代码、公共地址、交易 hash 与验证记录。
