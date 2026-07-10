# ERC-4337 真实执行层部署记录（Monad Testnet）

> 学习用途，仅限 Monad Testnet（Chain ID `10143`）。此部署为浏览器真实 UserOperation + 后端 Bundler/Paymaster 接入准备基础合约；当前公开前端尚未连接 relay API，不能把它当成开放的生产服务。

## 统一配置

- 网络：Monad Testnet
- Chain ID：`10143`
- EntryPoint v0.8：`0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`
- Sponsor / 课程账户：`0x7c0343c808B827e4286381c2292d92c3f19152a4`

## 已部署合约

- SessionKeyDemoTarget：`0x45CfcCa5e75474A711d077fB46bE3F77aFe31271`
  - 部署交易：[0xadd048…01fac](https://testnet.monadvision.com/tx/0xadd048984a8d114e52b37b6bdaab6e24c8583a8a9852628b881e3ed804d01fac)
- SessionKeyAccountFactory：`0x897590242F77Bc91c83D2b5fe231C6CAF69a7A10`
  - 部署交易：[0x55f031…a5987](https://testnet.monadvision.com/tx/0x55f0311302418fb4d7f0f1b166fde42d596aca281a40115fe71415994f2a5987)
- CampaignSponsoredPaymaster：`0x33653d01143e6f7fF59036Aac0Ff78f55358600b`
  - 部署交易：[0x0c1eec…00b455](https://testnet.monadvision.com/tx/0x0c1eecc965abf94023d201f0b7cf6b7718927eca6529d7dfc45bc250db00b455)

## Paymaster 初始测试网预算

- EntryPoint deposit：`0.2 MON`
- 充值交易：[0xbee738…2c4d86](https://testnet.monadvision.com/tx/0xbee7381b671d558fac5b1e6d2305984bd170b6de1a76a9993ffb5af3612c4d86)
- 已用 `cast receipt` 验证该交易 `status = true`。

## 链上验证

三个合约地址均已读取到非空 bytecode；Paymaster 在 EntryPoint 内的 deposit 已确认是 `200000000000000000 wei`（`0.2 MON`）。

## 下一步

1. 完成仅绑定 localhost 的 sponsor/relay API：后端签署短时 Paymaster authorization，并在校验白名单与频率后调用 `EntryPoint.handleOps`。
2. 前端把“模拟”替换为用户钱包签名、提交 relay、轮询 receipt 的真实操作。
3. 后端 API 通过 Cloudflare Tunnel 或 Nginx HTTPS 暴露受限的 `/health`、`/v1/sponsor`、`/v1/relay`，密钥永不进入浏览器或 Vercel 环境变量。
