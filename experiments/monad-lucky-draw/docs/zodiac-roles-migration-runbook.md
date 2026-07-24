# Zodiac Roles Session 迁移 Runbook

**状态（2026-07-24）：** Roles **栈已部署**，且 **enable + Session Key draw + 越权 revert** 已在 Monad Testnet 证明。产品路径为 **`zodiac-roles-session`**（`rolesSessionEnabled` + `onchainRolesProofPresent`）。

**已取代：** Safe7579 Smart Session 产品路径（见 [`safe7579-migration-runbook.md`](./safe7579-migration-runbook.md)）。

**已放弃：** 将 Pimlico 替换为 ZeroDev；账户保持 Safe 1.4.1，激活与 Roles **启用**仍走 Pimlico Bundler；**抽奖**为 Session Key 普通 EOA 交易。

## 两条路径必须分开标注

| 模式 | 账户 | 权限边界 | Gas | 次数 |
|---|---|---|---|---|
| `legacy-owner-session` | Safe 1.4.1 | Session Key = Safe owner（threshold=1）+ 服务端拒签 | EntryPoint Deposit + Safe4337 UserOp | **3 次** + 24h TTL |
| `zodiac-roles-session` | 同一 Safe + Roles Modifier | Session Key = Roles member（**非** owner），仅 `LuckyDraw.draw()` / value=0 | 启用：Deposit UserOp；抽奖：Session Key native MON tip（0.1 MON） | **无次数上限** + 24h TTL |

UI：`GET /api/draw/roles-readiness` → `mode: zodiac-roles-session`（栈 bytecode + 证明门闩均已打开）。

## 证明记录

- 栈：[`../contracts/artifacts/roles-deploy-receipt.monad-testnet.json`](../contracts/artifacts/roles-deploy-receipt.monad-testnet.json)
- Session：[`../contracts/artifacts/roles-session-proof.monad-testnet.json`](../contracts/artifacts/roles-session-proof.monad-testnet.json)
- 摘要：[`onchain-proof.md`](./onchain-proof.md)

## 运维注意

- Owner 若为 EIP-7702 委托账户，须保持 ≥ 10 MON reserve，再 tip / `depositTo`
- Safe tip 转账勿钉死 `gas=21000`（Safe receive 需更多 gas）
- Session tip 须覆盖 Monad 高 gas；当前 `SESSION_KEY_GAS_TIP_WEI = 0.1 MON`
