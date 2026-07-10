# Monad ERC-4337 实验前端

一个用 Vue 3、TypeScript、Wagmi Core 和 Viem 编写的最小前端，用来展示已完成的 Monad Testnet ERC-4337 实验：

- Counterfactual deployment / `initCode`
- Paymaster / sponsored UserOperation
- Session Key / 受限权限

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
