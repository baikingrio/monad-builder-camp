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

启用免弹窗会把浏览器生成的 Session Key 通过一次 Owner UserOp `addOwnerWithThreshold` 加入 Safe（可赞助）。后续抽奖由 Session Key 本地签名，服务端强制仅 `LuckyDraw.draw()`、value=0、无 Paymaster，并在签名之前检查当前 Safe 的 EntryPoint Deposit 是否覆盖保守 gas 估算。次数仍为 **3 次**并保留 TTL，不是无限抽卡。链上 Session Key 作为 owner（threshold=1）密码学权限较宽，仅适合测试网 Demo。
