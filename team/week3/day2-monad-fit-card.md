# Week 3 Day 2｜Monad Fit Card

## 为什么这个问题需要链上能力

本项目不是只解释概念。学习者需要核对 Safe、Safe 4337 Module 和 EntryPoint 是否确实部署在指定网络，并理解 UserOperation 最终由 EntryPoint 处理、需要账户 Owner 授权以及外部基础设施参与。公开 RPC 读取与浏览器链接让这些判断可重复核查。

## 为什么选择 Monad Testnet

- 学习目标本身是 Monad Builder Camp 的账户抽象实践；
- Monad Testnet（Chain ID `10143`）上已有本项目使用的 Safe 1.4.1、Safe 4337 Module 与 EntryPoint v0.7 基础合约；
- 测试网允许在不处理真实资产的条件下，展示部署验证、配置检查和后续模拟路径；
- 页面会使用 Monad RPC 和 MonadVision 链接，避免将其他网络的证据误写成 Monad 结果。

## 真实、只读与预设内容的边界

### 已真实验证

- Monad Testnet Chain ID 为 `10143`；
- 下列固定地址可通过 Monad 公共 RPC 进行 bytecode 只读检查：
  - Safe v1.4.1：`0x41675C099F32341bf84BFc5382aF534df5C7461a`
  - Safe 4337 Module：`0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226`
  - EntryPoint v0.7：`0x0000000071727De22E5E9d8BAf0edAc6f37da032`

### 只读页面能力

- 读取上述固定地址的公开 bytecode；
- 打开 MonadVision 地址页面；
- 展示发送 UserOperation 前的检查项和预设案例字段。

### 预设 / mock 内容

- 预设案例仅用于解释 UserOperation 的目标、value、calldata、签名与基础设施依赖；
- 它不是已签名、已模拟或已广播的真实 UserOperation；
- 页面不得将预设案例显示为交易 hash、真实 Safe 或可执行授权。

### 当前未实现

- 创建 Safe；
- 取得 Owner 签名；
- 运行 Bundler 模拟；
- 配置或使用 Paymaster 赞助；
- 发送 UserOperation。

## 安全边界

- 仅限 Monad Testnet；
- 不连接钱包、不请求签名、不发送交易；
- 不在仓库、页面或截图中存放私钥、助记词、未受限 API Key；
- 任何后续真实 UserOperation 都须先完成独立模拟、严格赞助策略和 Owner 明确确认。

## 核查来源

- [Monad Testnet canonical contracts](https://docs.monad.xyz/developer-essentials/testnets)
- [Safe supported networks](https://docs.safe.global/advanced/smart-account-supported-networks)
- Demo 页面：`experiments/erc4337-frontend/app/pages/safe-4337-monad.vue`
