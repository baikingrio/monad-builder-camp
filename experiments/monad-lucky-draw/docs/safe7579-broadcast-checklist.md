# Safe7579 Task 5 — 广播授权清单（草稿，未授权 · 已归档）

**状态：产品路径已由 Zodiac Roles 取代。禁止 `--broadcast` / `SAFE7579_ALLOW_BROADCAST=true`。请改用 [`zodiac-roles-broadcast-checklist.md`](./zodiac-roles-broadcast-checklist.md)。**

以下内容仅作历史归档。

本清单满足迁移计划 Task 5 的「向用户提供」要求；勾选「用户确认」前不得发链上交易。

## 1. 第三方产物与 pinned SHA

| 组件 | 仓库 | Tag / Commit |
|---|---|---|
| Safe7579 | `rhinestonewtf/safe7579` | `v2.0.0` / `40d92beeb423ec6a94d5667350086148df8b170c` |
| SmartSessions | `erc7579/smartsessions` | `v1.0.0` / `dc20f0b90541ef93e88177690b0c882384896332` |

哈希与 SPDX：见 [`contracts/vendor-manifest.safe7579.json`](../contracts/vendor-manifest.safe7579.json)、[`docs/safe7579-deployment-provenance.md`](./safe7579-deployment-provenance.md)。

自定义 Policy（`DrawOnlyActionPolicy` / `SessionTimeWindowPolicy`）：`localOnly`、`NOT_AUDITED`、`deploymentEligible: false` — **当前不得作为 Monad 部署目标**。

## 2. 计划交易（仅在授权后执行；数量待 Deploy 脚本 dry-run 定稿）

预期类别（非最终 nonce 列表）：

1. 部署 Safe7579 Adapter / Launchpad（若选用非确定性地址路径）
2. 部署 SmartSession（及 Registry 依赖若缺失）
3. 部署已审计 Action / Time / Value policy（**不能**用 smartsessions `test/mock`）
4. 可选：部署项目自定义 Policy（仅在独立审计通过且 manifest 解禁后）
5. 创建**新** Safe7579 账户（不得复用 legacy `0xB127…B276`）
6. 安装 Smart Session + Policy 配置（仅 `LuckyDraw.draw()` / value=0 / 时间窗）
7. 用户自行 `EntryPoint.depositTo(newSafe)`（应用不代转 legacy deposit）

## 3. 发送 EOA / Gas

- 发送方：待用户指定测试网 EOA
- Gas：EOA 原生 MON（非 Paymaster 部署交易）
- 应用密钥：永不用于部署广播

## 4. 新地址与 bytecode hash

授权后由 `VerifySafe7579Stack` / Deploy 输出填写。当前 Monad `knownAbsent` 地址 `eth_getCode` 均为空（2026-07-24 Verify dry-run 已确认）。

## 5. 本地验证证据（可随时重跑）

```bash
cd experiments/monad-lucky-draw
npm test
cd contracts && forge test --summary
forge script script/VerifySafe7579Stack.s.sol:VerifySafe7579Stack --fork-url https://testnet-rpc.monad.xyz
forge script script/DeploySafe7579Stack.s.sol:DeploySafe7579Stack --fork-url https://testnet-rpc.monad.xyz
forge script script/CreateLuckyDrawSmartSession.s.sol:CreateLuckyDrawSmartSession --fork-url https://testnet-rpc.monad.xyz
```

期望：`deployment.permitted=false`；Deploy/Create 不广播；knownAbsent codeLength=0。

## 6. 回滚 / 恢复

- 未广播前：无链上回滚需求；保持 `deployment.permitted=false`。
- 若已错误广播：停止产品开关；勿将新 Safe 标为默认；保留 legacy 路径；记录地址与 tx 到 `docs/onchain-proof.md` 的「误部署」附录。

## 7. Session Key 无 admin/transfer 路径证明

本地证据：`DrawOnlySmartSession.t.sol`（target/selector/value/expiry/owner-only revoke）。  
链上证据：须在真实 SmartSession + Policy 部署后补齐（任意 calldata / 转账 UserOp 被拒的 receipt）。

## 用户确认区

- [ ] 我已阅读 pinned SHA 与 SPDX
- [ ] 我确认自定义 Policy 在未审计前不得部署
- [ ] 我确认发送 EOA 与 Gas 来源
- [ ] 我明确授权在 Monad Testnet（10143）广播上述交易

**签名人 / 日期：** ________________（未填 = 未授权）
