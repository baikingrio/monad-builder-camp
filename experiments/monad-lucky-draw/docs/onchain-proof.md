# Monad Lucky Draw｜Monad Testnet 链上 Proof

## 已完成的真实链上内容

### 抽卡合约

- 网络：Monad Testnet（Chain ID `10143`）
- 合约：`MonadLuckyDraw`
- 合约地址：[`0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70`](https://testnet.monadvision.com/address/0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70)
- 部署交易：[`0x87a0966b743ee749b7af9e1fd7cbe6b8d8e04c6e454ed6a42592dfadba9d7ee6`](https://testnet.monadvision.com/tx/0x87a0966b743ee749b7af9e1fd7cbe6b8d8e04c6e454ed6a42592dfadba9d7ee6)

### 首次赞助激活 + 抽卡（2026-07-22）

- Safe：[`0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276`](https://testnet.monadvision.com/address/0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276)
- UserOperation：`0x6575bac739c97acd2ffb1466fec690c67e260fa89d891bc3f14d2b43ddfff93e`
- 交易：[`0xfd3e1a879728595da7ce01fac221b91a0f9c25beeb1481f32420faab7245fc11`](https://testnet.monadvision.com/tx/0xfd3e1a879728595da7ce01fac221b91a0f9c25beeb1481f32420faab7245fc11)
- Owner / 部署者：`0x7c0343c808B827e4286381c2292d92c3f19152a4`

### Session Key 免弹窗抽奖（2026-07-22；历史 Sponsor receipt）

- Safe：[`0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276`](https://testnet.monadvision.com/address/0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276)
- 交易：[`0x4d334a92634567482bd906afe4b2cccc325de152bd936ccb2641af9618dfb604`](https://testnet.monadvision.com/tx/0x4d334a92634567482bd906afe4b2cccc325de152bd936ccb2641af9618dfb604)
- 说明：该 receipt 是 Phase A 之前的 Sponsor 历史证据。Phase A 后首次激活与 Session Key 启用仍可赞助；后续 Session Draw 无 Paymaster，使用用户 EOA 直接 `EntryPoint.depositTo(currentSafe)` 充值的 Deposit 支付 Gas。

## 产品能力状态

- [x] EOA 登录绑定
- [x] Counterfactual Safe 派生与链上部署检查
- [x] Pimlico 赞助首次激活抽卡（有公开 receipt）
- [x] Session Key 免弹窗抽奖（有公开 receipt）
- [ ] 自建 Demo Faucet

## Session Key 说明

### Zodiac Roles（当前产品路径，2026-07-24）

- Safe：[`0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276`](https://testnet.monadvision.com/address/0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276)
- Roles Modifier（CREATE2 proxy）：[`0xF6452e2423e0abEA5C1694408DC2B72A9e299De7`](https://testnet.monadvision.com/address/0xF6452e2423e0abEA5C1694408DC2B72A9e299De7)
- Session Key（Roles member，非 owner）：`0xbfa431122c17905F623685141D1A06D9433aC7F2`
- Enable Tx：[`0x44a6a080d849a81fa6abd80f8ed42e3f9aa7ba368aa303c425cd4b64c8d24b77`](https://testnet.monadvision.com/tx/0x44a6a080d849a81fa6abd80f8ed42e3f9aa7ba368aa303c425cd4b64c8d24b77)
- Draw Tx：[`0xe61c0226fc36d487b5b8486bf2fe006de7d68504c2029bc4495ab0b0c670025f`](https://testnet.monadvision.com/tx/0xe61c0226fc36d487b5b8486bf2fe006de7d68504c2029bc4495ab0b0c670025f)
- 越权：非 `draw()` selector 的 `execTransactionWithRole` 已 revert（`0xd0a9bf58`）
- 工件：[`../contracts/artifacts/roles-session-proof.monad-testnet.json`](../contracts/artifacts/roles-session-proof.monad-testnet.json)

启用：Owner UserOp 安装 Roles（Session Key = member）并向 Session Key tip 0.1 MON。抽奖：Session Key EOA 调 `execTransactionWithRole(draw)`，无 bundler。自付 gas，**无次数上限**；仍保留 24h TTL。

### Legacy owner-based Session Key（历史）

启用免弹窗会把浏览器生成的 Session Key 通过一次 Owner UserOp `addOwnerWithThreshold` 加入 Safe。后续抽奖由 Session Key 本地签名 UserOp，服务端强制仅 `LuckyDraw.draw()`。已被 Roles 路径取代。

### Zodiac Roles 栈部署（2026-07-24）

CREATE2 部署到 Monad Testnet（与多链同址），Deployer `0x7c0343c808B827e4286381c2292d92c3f19152a4`：

| 合约 | 地址 | Tx |
|---|---|---|
| Integrity | [`0x6a6Af4b16458Bc39817e4019fB02BD3b26d41049`](https://testnet.monadvision.com/address/0x6a6Af4b16458Bc39817e4019fB02BD3b26d41049) | [`0xeb6b…`](https://testnet.monadvision.com/tx/0xeb6b15380c571ff461647fe532d3e9b4652a6825ae64dd2de7c80d82830f1bd5) |
| Packer | [`0x61C5B1bE435391fDd7BC6703F3740C0d11728a8C`](https://testnet.monadvision.com/address/0x61C5B1bE435391fDd7BC6703F3740C0d11728a8C) | [`0xfe92…`](https://testnet.monadvision.com/tx/0xfe92c6864d4586768dfc174bb463b78e40ea826f98edf16eda641482409c170c) |
| Roles | [`0x9646fDAD06d3e24444381f44362a3B0eB343D337`](https://testnet.monadvision.com/address/0x9646fDAD06d3e24444381f44362a3B0eB343D337) | [`0x4710…`](https://testnet.monadvision.com/tx/0x471021d1dbb3895769c82fb58dd0f56752ed58640acdf876cea40f6b31b37ca3) |
| ModuleProxyFactory | [`0x000000000000aDdB49795b0f9bA5BC298cDda236`](https://testnet.monadvision.com/address/0x000000000000aDdB49795b0f9bA5BC298cDda236) | [`0x945d…`](https://testnet.monadvision.com/tx/0x945daf82a6a3e2b9dc3c0371f1e82b948e473e6c2fe387a03cc3d5900e43afb7) |

Safe7579 产品路径已取消。详见 [`zodiac-roles-migration-runbook.md`](./zodiac-roles-migration-runbook.md)。
