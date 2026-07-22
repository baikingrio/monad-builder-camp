# Monad Lucky Draw

Monad Testnet 上的独立账户抽象抽卡实验。目标是让用户用自己的 EOA 完成首次明确授权，获得可预测的 AA Safe 地址，并在受限 Sponsor 支持下完成一次抽卡。

> 当前状态：**仅完成架构与安全脚手架，尚未部署合约、尚未创建 Safe、尚未发送 UserOperation、尚未启用 Sponsor 或 Session Key。**

## 计划中的体验

1. 连接 EOA，并签署带 nonce 与过期时间的身份绑定消息；
2. 推导对应的 counterfactual Safe 地址；
3. 用户主动点击“激活并免费抽一次”，由一次性、固定 `draw()` 调用的 Sponsor policy 支持；
4. 在真实链上授权和安全门槛完成后，为后续抽卡开放受限 Session Key，避免每次弹出钱包。

详细执行计划：[`docs/2026-07-22-implementation-plan.md`](./docs/2026-07-22-implementation-plan.md)。

## 安全边界

- 仅 Monad Testnet（Chain ID `10143`），不处理真实资产；
- 浏览器绝不保存 Paymaster Key、Sponsor 私钥或运营钱包私钥；
- Sponsor 默认关闭；在持久化资格记录、限流、预算、审计和熔断器完成前，不得对公网启用；
- 登录签名只用于身份绑定，不等同于链上 AA 授权；
- 后续“免钱包弹窗”只允许在链上确认的 Session Key 权限范围内调用固定抽卡函数；
- 当前“领取测试 MON”仅计划提供官方 Faucet 链接；自建 Faucet 需独立安全 Gate。

## 初始化后运行

```bash
cd experiments/monad-lucky-draw
cp .env.example .env
npm install
npm test
npm run build

cd contracts
forge test
```

不要提交 `.env`、私钥、Pimlico Key、Foundry broadcast / cache 或任何生产凭证。
