# Monad Lucky Draw｜Monad Testnet 链上 Proof

## 已完成的真实链上内容

- 网络：Monad Testnet（Chain ID `10143`）
- 合约：`MonadLuckyDraw`
- 合约地址：[`0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70`](https://testnet.monadvision.com/address/0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70)
- 部署交易：[`0x87a0966b743ee749b7af9e1fd7cbe6b8d8e04c6e454ed6a42592dfadba9d7ee6`](https://testnet.monadvision.com/tx/0x87a0966b743ee749b7af9e1fd7cbe6b8d8e04c6e454ed6a42592dfadba9d7ee6)
- 部署者：`0x7c0343c808B827e4286381c2292d92c3f19152a4`

## 本次验证

- 部署交易 receipt status：`true`；
- 合约地址返回非空 bytecode；
- 部署者的初始 `drawCount`：`0`；
- 本地 Foundry 测试：`4 / 4` 通过。

## 合约行为与限制

`draw()` 会记录调用者的抽卡次数，并发出 `CardDrawn` 事件。它不能接收 MON，也没有管理员、Token、NFT、转账或任意外部调用能力。

卡牌稀有度来自调用者、抽卡次数和 `block.prevrandao` 的伪随机计算。该随机性可被操纵，仅用于 Demo，不是生产级随机数。

## 尚未完成的产品能力

当前真实部署的是抽卡合约，不代表以下路径已经完成：

- EOA 登录签名的浏览器接入；
- Counterfactual Safe 的真实派生与部署；
- 一次性 Paymaster Sponsor；
- 真实 AA UserOperation 抽卡；
- Session Key 免钱包弹窗抽卡；
- 项目方 Demo Faucet。

这些能力依赖服务端持久化资格记录、限流、预算、熔断器、真实签名验证、Safe / EntryPoint 兼容性与可用的 Monad Paymaster 配置。当前 Sponsor API 按设计保持关闭，不会伪造成功状态。
