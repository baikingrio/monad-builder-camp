# Monad ERC-4337 实验前端

一个用 Vue 3、TypeScript、Wagmi Core 和 Viem 编写的最小前端，用来展示已完成的 Monad Testnet ERC-4337 实验：

- Counterfactual deployment / `initCode`
- Paymaster / sponsored UserOperation
- Session Key / 受限权限

页面还提供三个可逐步点击的应用场景模拟：

- 新用户领取活动徽章：先预测地址、预充值，再由第一笔 UserOperation 部署账户并领取。
- 免 Gas 的首次活动签到：Paymaster deposit 预存预算，用户签名后由 Paymaster 在规则内赞助 Gas。
- 链游每日签到：Session Key 只允许低风险 `checkIn(string)`，不能转 MON 或调用其他合约。

每次点击只更新本地模拟状态与事件时间线，**不会发送链上交易**。

## 开发

```bash
npm install
npm run dev
```

打开 Vite 输出的本地地址后，可用浏览器注入钱包连接 Monad Testnet，读取钱包余额；页面中的实验 proof 链接会打开 MonadVision。

> 本项目不在前端构造或发送 UserOperation，也不会保存私钥或 Session Key。它目前是链上实验的可视化和验证入口。

## 校验

```bash
npm test
npm run build
```
