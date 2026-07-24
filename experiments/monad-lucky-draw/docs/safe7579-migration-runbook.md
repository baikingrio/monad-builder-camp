# Safe7579 Smart Session 迁移 Runbook

**状态（2026-07-24）：** **已由 Zodiac Roles 取代（superseded）。** 不再作为产品下一跳。Monad Testnet 上 Safe7579 Launchpad、Adapter、Smart Session Emissary 与上游 Policy 地址均为空 bytecode。产品路径仍为 **legacy owner-based Session Key**，下一目标见 [`zodiac-roles-migration-runbook.md`](./zodiac-roles-migration-runbook.md)。

**已放弃：** 将 Pimlico 替换为 ZeroDev 的评估不再推进；账户保持 Safe 1.4.1，基础设施维持现有 Pimlico Bundler/Paymaster。

**归档说明：** 本目录下 Safe7579 自定义 Policy、本地 harness、manifest 与 readiness API **保留只读**，但禁止再设 `SAFE7579_ALLOW_BROADCAST=true` 或把 7579 当产品启用路径。链上强约束改为 Zodiac Roles。

## 历史两条路径（已冻结）

| 模式 | 账户 | 权限边界 | 次数 |
|---|---|---|---|
| `legacy-owner-session` | Safe 1.4.1 `0xB127…B276` 等 | Session Key = Safe owner（threshold=1）+ 服务端拒签 | **3 次** + 24h TTL |
| `safe7579-smart-session` | **已取消产品计划** | （归档）链上 Action/UserOp Policy | — |

UI 主路径改为 `GET /api/draw/roles-readiness`。`GET /api/draw/safe7579-readiness` 仍可读，文案标明已归档。

## 本地已完成（归档保留）

1. 自定义 Policy 单测：`DrawOnlyActionPolicy`、`SessionTimeWindowPolicy`
2. 组合 harness：`DrawOnlySmartSession.t.sol`
3. Manifest / preflight：`deployment.permitted=false`
4. 非广播脚本：Verify / Deploy / Create Safe7579Stack
5. 前端 readiness：`app/lib/safe7579Readiness.ts` + `/api/draw/safe7579-readiness`
6. Task 5 清单草稿：[`docs/safe7579-broadcast-checklist.md`](./safe7579-broadcast-checklist.md)（**未授权，且不再推进**）

## 广播

**禁止**再推进 Safe7579 广播。若需链上强约束，走 Zodiac Roles 清单：[`zodiac-roles-broadcast-checklist.md`](./zodiac-roles-broadcast-checklist.md)。
