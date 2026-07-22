# Week 3｜Problem & Mini Demo Card

## 团队与方向

- **团队成员**：Hagoo（Research）、ritscher（Ops）、Q（Dev）
- **项目**：Monad Account Abstraction Practice Lab / Monad Lucky Draw
- **本周目标**：让刚接触 Safe 与 ERC-4337 的学习者，看懂“首次明确授权”和“后续受限免弹窗”之间的差别，并能核对真实 Monad Testnet 证据。

## 目标用户

刚开始接触 Monad 上智能账户、Safe 或 ERC-4337 的学习者和开发者。他们可能知道 Paymaster、Bundler、Session Key 等概念，但没有亲自走过一条从 EOA 到 Safe UserOperation 的完整路径。

## 核心问题

用户容易把三件事混在一起：

1. Safe、EntryPoint 和 Paymaster 已经存在；
2. 用户已经授权某个智能账户操作；
3. 后续操作为什么可以少一次钱包弹窗。

如果产品只告诉用户“Sponsored / Gasless”，用户很难判断：谁签了什么、Sponsor 到底负责什么、Session Key 是否被无限授权、哪一部分真的上链了。

## 当前解决方式

用户通常需要分别阅读 Safe、Pimlico、ERC-4337 与钱包的文档，或者只看到一次交易成功的 hash。这样能知道单个组件存在，却很难把“身份绑定 → Owner 明确授权 → 赞助 UserOperation → Session Key 受限后续操作”连成一条可检查的产品路径。

## 我们的方案

提供一个面向 Monad Testnet 的 Lucky Draw 学习型 Demo：

1. 用户连接 EOA 并签署一次仅用于登录的 nonce 消息；
2. 页面推导对应 Counterfactual Safe，并由用户明确点击检查是否已部署；
3. 首次点击「激活并免费抽一次」时，Owner 明确签署固定 `LuckyDraw.draw()` 的 Safe UserOperation，Pimlico 只赞助该合格操作的 gas；
4. 用户可再明确启用短期 Session Key；之后固定抽卡由 Session Key 本地签名，不再弹出钱包；
5. 页面展示 Safe、UserOperation、交易回执和 MonadVision 链接，而不是把本地状态写成成功。

## Mini Demo 核心功能

**首次授权抽卡 + 受限免弹窗抽卡。**

- 固定网络：Monad Testnet（`10143`）；
- 固定目标：`MonadLuckyDraw.draw()`；
- 固定 value：`0`；
- 首次操作：Owner 必须明确签名；
- 后续操作：只接受短期、有限次数、固定 `draw()` 的 Session Key 请求；
- 服务端不向浏览器暴露 Pimlico API Key，也拒绝任意 calldata。

## 已有真实证据

抽卡合约：

- 合约：[`0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70`](https://testnet.monadvision.com/address/0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70)

首次赞助激活与抽卡：

- Safe：[`0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276`](https://testnet.monadvision.com/address/0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276)
- UserOperation：`0x6575bac739c97acd2ffb1466fec690c67e260fa89d891bc3f14d2b43ddfff93e`
- 交易：[`0xfd3e1a879728595da7ce01fac221b91a0f9c25beeb1481f32420faab7245fc11`](https://testnet.monadvision.com/tx/0xfd3e1a879728595da7ce01fac221b91a0f9c25beeb1481f32420faab7245fc11)

Session Key 免弹窗抽卡：

- 交易：[`0x4d334a92634567482bd906afe4b2cccc325de152bd936ccb2641af9618dfb604`](https://testnet.monadvision.com/tx/0x4d334a92634567482bd906afe4b2cccc325de152bd936ccb2641af9618dfb604)

实现与完整链上说明：

- [Monad Lucky Draw README](../../experiments/monad-lucky-draw/README.md)
- [链上 Proof](../../experiments/monad-lucky-draw/docs/onchain-proof.md)
- [2026-07-22 Daily](../../daily/2026-07-22.md)

## 本周明确不做

- 不做主网或真实资产操作；
- 不做任意 target、任意 calldata 或任意 value 的 Session Key；
- 不公开 Paymaster 凭证、运营私钥、助记词或 `.env`；
- 不把 Sponsor 说成账户授权，也不把登录签名说成链上授权；
- 不把当前 owner 型 Session Key 当作生产级或长期权限方案；
- 不做通用钱包、通用 relayer 或多协议 Agent。

## 成功标准

团队外的一位学习者体验后，能在 3 分钟内说清：

1. 首次抽卡为什么需要 Owner 明确签名；
2. Paymaster 只负责什么，不能负责什么；
3. 后续免弹窗为何仍然有预先授权和范围限制；
4. 哪些信息是页面本地状态，哪些已有真实链上回执；
5. 当前 Demo 为什么只能用于 Monad Testnet。
