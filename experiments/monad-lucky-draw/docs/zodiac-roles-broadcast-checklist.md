# Zodiac Roles — 广播授权清单

**状态（2026-07-24）：栈已部署；Roles session enable + draw 证明已完成；产品路径 `zodiac-roles-session` 已打开。**

## 固定依赖

| 组件 | 仓库 | Pin |
|---|---|---|
| Zodiac Roles Modifier | `gnosisguild/zodiac-modifier-roles` | `81426d0a86309e9f84ad2d3ed4fad0725fd49a65` |
| Zodiac ModuleProxyFactory | `gnosisguild/zodiac-core` | `v3.0.1` |

Receipt：[`contracts/artifacts/roles-deploy-receipt.monad-testnet.json`](../contracts/artifacts/roles-deploy-receipt.monad-testnet.json)  
Session proof：[`contracts/artifacts/roles-session-proof.monad-testnet.json`](../contracts/artifacts/roles-session-proof.monad-testnet.json)

## 已部署地址（CREATE2，与其他链同址）

| 合约 | 地址 | Tx |
|---|---|---|
| Integrity | [`0x6a6Af4…1049`](https://testnet.monadvision.com/address/0x6a6Af4b16458Bc39817e4019fB02BD3b26d41049) | [`0xeb6b…1bd5`](https://testnet.monadvision.com/tx/0xeb6b15380c571ff461647fe532d3e9b4652a6825ae64dd2de7c80d82830f1bd5) |
| Packer | [`0x61C5…8a8C`](https://testnet.monadvision.com/address/0x61C5B1bE435391fDd7BC6703F3740C0d11728a8C) | [`0xfe92…170c`](https://testnet.monadvision.com/tx/0xfe92c6864d4586768dfc174bb463b78e40ea826f98edf16eda641482409c170c) |
| Roles mastercopy | [`0x9646…D337`](https://testnet.monadvision.com/address/0x9646fDAD06d3e24444381f44362a3B0eB343D337) | [`0x4710…7ca3`](https://testnet.monadvision.com/tx/0x471021d1dbb3895769c82fb58dd0f56752ed58640acdf876cea40f6b31b37ca3) |
| ModuleProxyFactory | [`0x0000…a236`](https://testnet.monadvision.com/address/0x000000000000aDdB49795b0f9bA5BC298cDda236) | [`0x945d…afb7`](https://testnet.monadvision.com/tx/0x945daf82a6a3e2b9dc3c0371f1e82b948e473e6c2fe387a03cc3d5900e43afb7) |

Deployer：`0x7c0343c808B827e4286381c2292d92c3f19152a4`  
ERC-2470 factory：`0xce0042b868300000d44a59004da54a005ffdcf9f`

## 已完成的产品切换动作

1. Roles enable（非 `addOwner`）→ Session Key EOA `execTransactionWithRole` 抽奖
2. 越权 selector 被 Roles revert；写入 `docs/onchain-proof.md`
3. `onchainRolesProofPresent=true`，`rolesSessionEnabled=true`
4. Roles 自付 gas 抽奖：**无次数上限**（仍保留 24h TTL）；legacy 仍为 3 次

## 明确禁止

- 把 Safe7579 当下一产品步重新启用
- 自建 Faucet / 为 Session Key 引入 Paymaster
- 对仍是 Safe owner 的 legacy Session Key 去掉 3 次上限（链上权限过宽）
