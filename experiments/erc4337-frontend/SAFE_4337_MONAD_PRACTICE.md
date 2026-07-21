# Monad Testnet Safe 4337 实践

入口：`/safe-4337-monad`

该页面是 **Safe 4337 on Monad Testnet** 的只读前置验证，不是 Safe Passkey 页面。

## 已确认的链上基础

- Monad Testnet：Chain ID `10143`
- Safe v1.4.1：`0x41675C099F32341bf84BFc5382aF534df5C7461a`
- Safe 4337 Module：`0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226`
- EntryPoint v0.7：`0x0000000071727De22E5E9d8BAf0edAc6f37da032`

来源：

- [Monad Testnet canonical contracts](https://docs.monad.xyz/developer-essentials/testnets)
- [Safe supported networks](https://docs.safe.global/advanced/smart-account-supported-networks)

## 支持边界

Safe 官方目录将 Monad Testnet 列为 Safe Smart Account、Safe 4337 Module、Safe{Core} SDK、Safe{Wallet}、Transaction Service 和 Event Service 的支持网络。

但目录**没有**把 Safe Passkey Module 标为 Monad Testnet 的支持功能。因此：

- 标准 Safe + ERC-4337：可作为官方支持路线继续集成。
- Safe + WebAuthn Passkey：应视为自部署 signer/verifier 的进阶工程，不能把 Sepolia Passkeys 教程直接换链后称为官方支持。

## 当前页面做什么

点击“验证链上基础合约”会通过 Monad 公共 RPC 读取三个固定地址的 bytecode。这个操作：

- 不连接钱包；
- 不创建 Safe；
- 不请求签名；
- 不发送 UserOperation。

页面也提供一份**预设的零 value UserOperation 学习案例**，用于区分“看懂一条操作结构”和“真的可以发送一条操作”。该案例明确没有真实 Safe 地址、Owner 签名、模拟结果或 UserOperation hash；它显示空 calldata 的学习说明，并要求先检查 Safe 存在、Owner 明确签名、Bundler 模拟，以及 Paymaster 策略或自付 gas。

因此它不是交易、不是可执行授权，也不能发送。

## 后续发送 UserOperation 前

1. 在 `.env` 设置受限的 `NUXT_PUBLIC_MONAD_PIMLICO_API_KEY`。
2. 以 Safe 1.4.1 + EntryPoint v0.7 建立 Safe，并在创建路径中启用 Safe 4337 Module。
3. 配置最小化的 Paymaster sponsorship policy、额度和审计记录。
4. 从浏览器钱包取得用户明确确认的 Owner 签名；不要在浏览器代码中保存私钥。
5. 先模拟，再提交 UserOperation，并保留 MonadVision/Jiffyscan 的公开 proof。

Pimlico 的 Monad Testnet endpoint 格式为：

```text
https://api.pimlico.io/v2/10143/rpc?apikey=YOUR_KEY
```
