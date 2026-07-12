# monad-playground

Monad Builder Camp 链上实验 Foundry 项目，用于合约验证与测试网交互。

## 网络

| 项目 | 值 |
|------|-----|
| 网络 | Monad Testnet |
| Chain ID | `10143` |
| RPC | `https://testnet-rpc.monad.xyz` |
| 水龙头 | https://faucet.monad.xyz |

## 领水（测试 MON）

部署合约需要测试网 MON 作为 gas。以下为可用的领水方式。

### 方法一：官方网页水龙头（推荐）

1. 打开 https://faucet.monad.xyz
2. 粘贴钱包地址
3. 按页面提示完成验证
4. 领取测试 MON

### 方法二：devnads API（命令行）

```shell
curl -X POST https://agents.devnads.com/v1/faucet \
  -H "Content-Type: application/json" \
  -d '{"chainId": 10143, "address": "0x你的钱包地址"}'
```

成功响应示例：

```json
{
  "txHash": "0x...",
  "amount": "1000000000000000000",
  "chain": "Monad Testnet"
}
```

每次约发放 **1 MON**（`1e18` wei），一般足够多次部署。

### 确认余额

```shell
cast balance 0x你的地址 --rpc-url https://testnet-rpc.monad.xyz --ether
```

### 注意事项

- 仅用于 **Monad Testnet**（Chain ID `10143`），勿用于主网
- 私钥保存在本地 `.env`，不要提交到 git
- 若 API 领水失败，改用官方网页水龙头

## 合约

| 合约 | 说明 |
|------|------|
| `CampToken` | 简易 ERC20，符号 `CAMP`，初始供应 1,000,000 |

## 常用命令

### 构建与测试

```shell
forge build
forge test
```

### 部署 CampToken

1. 复制 `.env.example` 为 `.env`，填入测试网私钥
2. 从[领水](#领水测试-mon)获取测试 MON
3. 执行部署：

```shell
source .env
forge script script/DeployCampToken.s.sol:DeployCampToken \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### 链上查询

```shell
cast call <合约地址> "name()(string)" --rpc-url https://testnet-rpc.monad.xyz
cast call <合约地址> "symbol()(string)" --rpc-url https://testnet-rpc.monad.xyz
cast call <合约地址> "totalSupply()(uint256)" --rpc-url https://testnet-rpc.monad.xyz
```

### 源码验证

部署后在区块浏览器上开源合约源码，便于查看和交互。

#### MonadVision / Sourcify（推荐，无需 API Key）

`CampToken` 部署时传入了 constructor 参数，验证时需要一并提交：

```shell
forge verify-contract \
  <合约地址> \
  src/CampToken.sol:CampToken \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/ \
  --constructor-args $(cast abi-encode "constructor(string,string,uint256)" "Camp Token" "CAMP" 1000000000000000000000000) \
  --watch
```

成功时会显示 `Status: exact_match`。然后在 [MonadVision](https://testnet.monadvision.com) 搜索合约地址，即可看到 Verified 源码。

#### Monadscan（可选，需 API Key）

```shell
forge verify-contract \
  <合约地址> \
  src/CampToken.sol:CampToken \
  --chain 10143 \
  --verifier etherscan \
  --etherscan-api-key <你的_API_KEY> \
  --verifier-url https://api-testnet.monadscan.com/api \
  --constructor-args $(cast abi-encode "constructor(string,string,uint256)" "Camp Token" "CAMP" 1000000000000000000000000) \
  --watch
```

#### 注意事项

- `--constructor-args` 必须与部署时一致，否则字节码匹配失败
- 若修改了合约名称、编译器版本或 constructor 参数，需同步更新验证命令
- 功能验证（读链）与源码验证是独立的：可用 `cast call` 确认合约可用，再用 `forge verify-contract` 提交源码

## 已部署（Testnet）

| 项目 | 值 |
|------|-----|
| CampToken | `0xef694e5411A70d05270722A38Ea9Ef242E3afcf2` |
| 部署交易 | `0x59d72a3596bc405f024b01a31a257a8ab2eed6dcb652473af924f312c53a5ff2` |
| Explorer | [MonadVision](https://testnet.monadvision.com/address/0xef694e5411A70d05270722A38Ea9Ef242E3afcf2) |
| 源码验证 | `exact_match`（Sourcify） |

## 已交互（Testnet）

| 项目 | 值 |
|------|-----|
| Write function | `transfer(address,uint256)` |
| 接收地址 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| 数量 | `1 CAMP`（`1000000000000000000`） |
| 交互交易 | `0xd496aae977b07d590ceeb512f871708061ca12ca2e91bc6c1da0ac6a1c9704b0` |
| Explorer | [MonadVision](https://testnet.monadvision.com/tx/0xd496aae977b07d590ceeb512f871708061ca12ca2e91bc6c1da0ac6a1c9704b0) |

## ERC-4337 最小实践（Testnet）

本实验补充了一个最小 ERC-4337 v0.7 风格账户 `Minimal4337Account`，用于理解 Account Abstraction 的基本链上流程。它不是生产级账户，只用于 Monad Builder Camp 学习：

1. 部署一个最小智能账户，保存 `owner` 和 `entryPoint`。
2. 由 `owner` 签名一个 `PackedUserOperation`。
3. 调用 Monad Testnet 上已有的 EntryPoint v0.7 `handleOps`。
4. EntryPoint 回调账户的 `validateUserOp` 验签。
5. 验签通过后，EntryPoint 通过账户执行 `execute`。

| 项目 | 值 |
|------|-----|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| Minimal4337Account | `0x672924dE597793C9f19e537c0B428A880eE89c2e` |
| 部署交易 | `0xa709a593f84aba8b3905f37e84ded3031d19ef7e043782d583cef17bc9cfee8e` |
| handleOps 交易 | `0xb8912d3183b135507c59135cffe3daf46639ce452c0074abb7d0552efb889a46` |
| UserOpHash | `0x1635d2ad89aa79cca42d7839739e0359b7cb85541fa5bd7d9e2d235555726eae` |
| EntryPoint nonce | `1` |
| 验证结果 | `deploy status = true`，`handleOps status = true` |

Explorer：

- Account: https://testnet.monadvision.com/address/0x672924dE597793C9f19e537c0B428A880eE89c2e
- handleOps tx: https://testnet.monadvision.com/tx/0xb8912d3183b135507c59135cffe3daf46639ce452c0074abb7d0552efb889a46

### v0.8 迁移记录

第一步迁移先保持账户合约和 UserOperation 构造方式不变，只把脚本切到 Monad Testnet 官方 EntryPoint v0.8，用课程专用账户完成一次真实 `handleOps`。

| 项目 | 值 |
|------|-----|
| EntryPoint v0.8 | `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108` |
| Minimal4337AccountV08 | `0xff76634Ea6D1407266a0fc6096f042416F258E24` |
| Owner / 课程账户 | `0x7c0343c808B827e4286381c2292d92c3f19152a4` |
| 部署交易 | `0x9d11f70e00619503e0f1aaa13dd7f8cf7a097099ba95a71a21df9fd7817dc539` |
| handleOps 交易 | `0xa7d556f9d4e30119b654a7c248281916bac433413e99b4ebeecdebdef374c34d` |
| UserOpHash | `0xf29daf942acc744a63dcb17a772e77524ff78ad0b10190cf168f086d7ec72864` |
| EntryPoint nonce | `1` |
| 账户代码大小 | `2952 bytes` |
| 账户余额 | `0.129 MON` |
| 验证结果 | `deploy status = true`，`handleOps status = true` |

Explorer：

- Account: https://testnet.monadvision.com/address/0xff76634Ea6D1407266a0fc6096f042416F258E24
- deploy tx: https://testnet.monadvision.com/tx/0x9d11f70e00619503e0f1aaa13dd7f8cf7a097099ba95a71a21df9fd7817dc539
- handleOps tx: https://testnet.monadvision.com/tx/0xa7d556f9d4e30119b654a7c248281916bac433413e99b4ebeecdebdef374c34d

### 第三步：counterfactual deployment / initCode 实验

这一步补充 `Minimal4337AccountFactory` 和 `Counterfactual4337PracticeV08`，用 `CREATE2 + initCode` 跑通“还没部署账户，但已经知道账户地址”的 ERC-4337 流程。

简单应用场景可以这样理解：

> 一个新用户第一次打开链上活动 App。App 可以先根据用户 EOA、EntryPoint 和 salt 算出他的智能账户地址，把这个地址展示给后端、空投系统或朋友转账。这个时候账户合约还没有部署，链上 `code.length = 0`，但这个地址已经可以先收测试币/资产。等用户第一次真正点击“领取徽章/签到/转账”时，UserOperation 带上 `initCode`，EntryPoint 会先通过 factory 部署账户，再立刻执行这次操作。

这能解决两个学习点：

1. **counterfactual deployment**：账户地址可以在部署前确定，前端/后端可以提前把它当作用户的钱包地址使用。
2. **initCode**：第一次 UserOperation 里携带“用哪个 factory、用什么参数创建账户”的数据，所以 Bundler/EntryPoint 可以在同一笔 `handleOps` 里完成“部署账户 + 执行操作”。

本次实际链上流程：

1. 部署 `Minimal4337AccountFactory`。
2. 通过 `factory.getAddress(entryPoint, owner, salt)` 预测智能账户地址。
3. 在账户尚未部署、`code.length = 0` 时，先向预测地址转入 `0.2 MON`。
4. 构造 `initCode = factory address + createAccount(entryPoint, owner, salt)`。
5. 发送 UserOperation，`sender` 填预测地址，`initCode` 负责首次部署账户。
6. EntryPoint 执行 `handleOps` 后，账户代码出现，nonce 从 `0` 增加到 `1`，并通过账户 `execute` 给 owner 转回 `0.001 MON`。

| 项目 | 值 |
|------|-----|
| EntryPoint v0.8 | `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108` |
| Factory | `0xfa8018f91f6da368f210ac391364c4395ae4d084` |
| CounterfactualAccount | `0x225b0Ab837621F548a86FE7B8D65a4A60079760B` |
| Owner / 课程账户 | `0x7c0343c808B827e4286381c2292d92c3f19152a4` |
| Factory 部署交易 | `0xd374005afdc8e06d73900cff15efe35c3aef6bc0bf3d016f48d8de7eaedfb35d` |
| 预充值交易 | `0x337feab15f4060654428c8f601e9c762fc5896a6ed071b85334fc9d86298443e` |
| handleOps 交易 | `0x07e26e0a94d9a48f7233e67d07fcd8f1f5f2b18edeadfd2fdd9bbf91bbebf380` |
| UserOpHash | `0xe55b262a7b6443b459ddb5374cd0962f0ac9c63bca96beb5ae1942fdd952f31f` |
| initCode 长度 | `120 bytes` |
| handleOps 后 EntryPoint nonce | `1` |
| 账户代码大小 | `2952 bytes` |
| 账户余额 | `0.083 MON` |
| 验证结果 | `factory deploy status = true`，`prefund status = true`，`handleOps status = true` |

Explorer：

- Factory: https://testnet.monadvision.com/address/0xfa8018f91f6da368f210ac391364c4395ae4d084
- Counterfactual account: https://testnet.monadvision.com/address/0x225b0Ab837621F548a86FE7B8D65a4A60079760B
- Factory deploy tx: https://testnet.monadvision.com/tx/0xd374005afdc8e06d73900cff15efe35c3aef6bc0bf3d016f48d8de7eaedfb35d
- Prefund tx: https://testnet.monadvision.com/tx/0x337feab15f4060654428c8f601e9c762fc5896a6ed071b85334fc9d86298443e
- handleOps tx: https://testnet.monadvision.com/tx/0x07e26e0a94d9a48f7233e67d07fcd8f1f5f2b18edeadfd2fdd9bbf91bbebf380

### 第四步：paymaster / sponsored UserOp 概念验证

这一步补充 `SimpleSponsoredPaymaster` 和 `SponsoredUserOpPracticeV08`，用一个极简 Paymaster 跑通“项目方替用户智能账户支付 UserOperation gas”的流程。

简单应用场景可以这样理解：

> 一个链上活动 App 想让新用户第一次签到/领取徽章时不用先准备 MON 付 gas。项目方部署 Paymaster，并提前往 EntryPoint 的 Paymaster deposit 里充值一笔 gas 预算。用户仍然用自己的 owner key 签名授权这次 UserOperation，但 `paymasterAndData` 指向活动方 Paymaster。EntryPoint 验证账户签名后，再调用 Paymaster 判断是否愿意赞助；验证通过后，这次 UserOp 的 gas 从 Paymaster deposit 扣，而不是从用户智能账户扣。

这能帮助理解三个点：

1. **Paymaster 不替用户授权**：用户仍然要签名 UserOperation，Paymaster 只决定是否赞助 gas。
2. **sponsored UserOp 的费用来源不同**：gas 由 Paymaster 在 EntryPoint 里的 deposit 支付，账户余额主要用于自己的业务动作。
3. **paymasterAndData 是赞助凭证入口**：v0.8 中至少包含 Paymaster 地址、paymaster verification gas limit、postOp gas limit；后面可以附加活动 ID、限额凭证或后端签名。

本次实际链上流程：

1. 部署一个新的 `Minimal4337Account`，只放入 `0.05 MON` 用于业务转账。
2. 部署 `SimpleSponsoredPaymaster`，并设置只赞助这个账户。
3. 由 owner 调用 `depositToEntryPoint`，给 Paymaster 在 EntryPoint 里的 deposit 充值 `0.3 MON`。
4. 构造带 `paymasterAndData` 的 UserOperation。
5. EntryPoint 先调用账户 `validateUserOp` 验签，再调用 Paymaster `validatePaymasterUserOp` 判断是否赞助。
6. 验证通过后执行账户 `execute`，账户给 owner 转回 `0.001 MON`；UserOp gas 从 Paymaster deposit 扣除。

| 项目 | 值 |
|------|-----|
| EntryPoint v0.8 | `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108` |
| SponsoredAccount | `0xB63ddC901392a182eD0eBc10c81fC5B2952936DD` |
| SimpleSponsoredPaymaster | `0x0DF510267FE287e0bf7724F28AFA07Ed755B1c96` |
| Owner / 课程账户 | `0x7c0343c808B827e4286381c2292d92c3f19152a4` |
| Account 部署交易 | `0xbf7b45371793ace45e083309adb93887a40eb0992f914cc59144268444347147` |
| Paymaster 部署交易 | `0x5633400aa0ea2266ec2d237c67a06cd970e8604cf875214ddbf9108081dac74c` |
| Paymaster deposit 交易 | `0xdf042dd9ce34170b55e4d29ed259ecf82692dd3962570dc5eeeee721ae5f4a4b` |
| sponsored handleOps 交易 | `0x44b2c02374367f43ab006be28b524ba32c3a75d9b65b4c34ea3811eeaef86b4d` |
| UserOpHash | `0x748239494916f5ea741987154e03e9d6ca30bb86b9d38e5d944895a64ac8d9d4` |
| paymasterAndData 长度 | `83 bytes` |
| handleOps 后 EntryPoint nonce | `1` |
| 账户代码大小 | `2952 bytes` |
| Paymaster 代码大小 | `3271 bytes` |
| 账户余额 | `0.049 MON` |
| Paymaster deposit 余额 | `0.2776184 MON` |
| 验证结果 | `account deploy status = true`，`paymaster deploy status = true`，`deposit status = true`，`handleOps status = true` |

Explorer：

- Sponsored account: https://testnet.monadvision.com/address/0xB63ddC901392a182eD0eBc10c81fC5B2952936DD
- Paymaster: https://testnet.monadvision.com/address/0x0DF510267FE287e0bf7724F28AFA07Ed755B1c96
- Account deploy tx: https://testnet.monadvision.com/tx/0xbf7b45371793ace45e083309adb93887a40eb0992f914cc59144268444347147
- Paymaster deploy tx: https://testnet.monadvision.com/tx/0x5633400aa0ea2266ec2d237c67a06cd970e8604cf875214ddbf9108081dac74c
- Deposit tx: https://testnet.monadvision.com/tx/0xdf042dd9ce34170b55e4d29ed259ecf82692dd3962570dc5eeeee721ae5f4a4b
- sponsored handleOps tx: https://testnet.monadvision.com/tx/0x44b2c02374367f43ab006be28b524ba32c3a75d9b65b4c34ea3811eeaef86b4d

### 第五步：session key / 受限权限实验

这一步补充 `MinimalSessionKeyAccount`、`SessionKeyDemoTarget` 和 `SessionKeyPracticeV08`，用一个临时 session key 跑通“不是 owner 全权限签名，但可以在限定范围内执行低风险操作”的流程。

简单应用场景可以这样理解：

> 一个链游或活动 App 不希望用户每次签到、移动、领取小积分都弹钱包签名。用户可以先授权一个临时 session key：它只能调用指定活动合约的 `checkIn(string)`，有效期只有一天，不能转账到任意地址，也不能调用其他函数。之后前端可以用这个 session key 替用户签低风险 UserOperation；即使 session key 泄露，攻击者也只能在限制范围内操作，拿不到 owner 的完整控制权。

这能帮助理解三个点：

1. **session key 不是新 owner**：owner 仍然保留全权限，session key 只是临时、受限授权。
2. **权限要在账户验证逻辑里检查**：本实验在 `validateUserOp` 中解析 `execute(target,value,data)`，检查目标合约、函数 selector、有效期和额度。
3. **适合高频低风险交互**：比如签到、链游动作、积分任务、自动化低额操作；不适合无限制转账或管理权限。

本次实际链上流程：

1. 部署 `SessionKeyDemoTarget`，模拟“活动签到 / 游戏每日动作”。
2. 部署 `MinimalSessionKeyAccount`，设置 owner、sessionKey、allowedTarget、allowedSelector、validUntil 和 nativeSpendLimit。
3. 构造 UserOperation，callData 是账户 `execute(target, 0, checkIn("session-key-demo"))`。
4. 用 session key 签名 UserOperation，而不是 owner key。
5. EntryPoint 调用账户 `validateUserOp`，账户验证 session key 签名，并检查只能调用指定 target + selector。
6. 验证通过后执行 `checkIn`，目标合约记录智能账户签到次数为 `1`。

| 项目 | 值 |
|------|-----|
| EntryPoint v0.8 | `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108` |
| SessionKeyAccount | `0xc01c4864631f8A23cBc2f59B8F1c3Eaa48dA4AD3` |
| SessionTarget | `0xF13D07F366E1DFdFaBA6D8c1Eca0A43fC7Ac5c79` |
| Owner / 课程账户 | `0x7c0343c808B827e4286381c2292d92c3f19152a4` |
| SessionKey | `0xD1F63b1CDf3ebcF8D7AFEb95a4618c8B9a3049FF` |
| allowedSelector | `0xf21bb4c5`（`checkIn(string)`） |
| nativeSpendLimit | `0` |
| Target 部署交易 | `0xe6fc9d5493c145d5eb4f05e7ac0a725a9a4849a5d4215a5fdc90c8b4aa8c944d` |
| Account 部署交易 | `0x8775ef8bf00937d77112533b9801aab484f35448b3923be4c3fe01f48344f88f` |
| session key handleOps 交易 | `0x1b40ca3f39e74b859d917bd927d3efee7c12484a54ce5610c6a9ec41d9bc224d` |
| UserOpHash | `0x570f483b9e14d8435d8218efc8687162b358ffdd56748990e106da926d5ac8e5` |
| handleOps 后 EntryPoint nonce | `1` |
| checkInCount | `1` |
| nativeSpent | `0` |
| Account 代码大小 | `5196 bytes` |
| Target 代码大小 | `2183 bytes` |
| Account 余额 | `0.032 MON` |
| 验证结果 | `target deploy status = true`，`account deploy status = true`，`handleOps status = true` |

Explorer：

- Session account: https://testnet.monadvision.com/address/0xc01c4864631f8A23cBc2f59B8F1c3Eaa48dA4AD3
- Session target: https://testnet.monadvision.com/address/0xF13D07F366E1DFdFaBA6D8c1Eca0A43fC7Ac5c79
- Target deploy tx: https://testnet.monadvision.com/tx/0xe6fc9d5493c145d5eb4f05e7ac0a725a9a4849a5d4215a5fdc90c8b4aa8c944d
- Account deploy tx: https://testnet.monadvision.com/tx/0x8775ef8bf00937d77112533b9801aab484f35448b3923be4c3fe01f48344f88f
- session key handleOps tx: https://testnet.monadvision.com/tx/0x1b40ca3f39e74b859d917bd927d3efee7c12484a54ce5610c6a9ec41d9bc224d

### 第六步：Sponsor 授权的只读 E2E 验证

新增的 `CampaignSponsoredPaymaster` 将 Sponsor 签名绑定到完整 UserOperation。测试网部署并向 EntryPoint deposit `0.05 MON` 后，仅以本地新签发的短时授权执行只读验证：原始请求返回 `validationData = 0`；仅篡改 `gasFees` 则返回 `validationData = 1`。整个过程没有提交 `handleOps`、relay 或广播交易。

- Paymaster：[`0xfe178d0068d91325118e65eA193D21976e9d8fcF`](https://testnet.monadvision.com/address/0xfe178d0068d91325118e65eA193D21976e9d8fcF)
- [部署交易](https://testnet.monadvision.com/tx/0x5e1c43345f3ac5799decc9908cc3c935529360e9713f212ee85daebd696b7fe1)；[deposit `0.05 MON`](https://testnet.monadvision.com/tx/0xd1ed671e59c5099d30e266e8110888ba48771f8e54a2fa78d439f6fe930a9f82)
- [完整只读 E2E 验证记录](docs/sponsor-authorization-e2e-verification.md)

运行方式：

```shell
export PRIVATE_KEY=<课程专用测试网钱包私钥>
forge script script/Minimal4337Practice.s.sol:Minimal4337Practice \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast \
  --legacy \
  -vv

# v0.8 迁移脚本
forge script script/Minimal4337PracticeV08.s.sol:Minimal4337PracticeV08 \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast \
  --legacy \
  -vv

# v0.8 counterfactual deployment / initCode 脚本
forge script script/Counterfactual4337PracticeV08.s.sol:Counterfactual4337PracticeV08 \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast \
  --legacy \
  -vv

# v0.8 paymaster / sponsored UserOp 脚本
forge script script/SponsoredUserOpPracticeV08.s.sol:SponsoredUserOpPracticeV08 \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast \
  --legacy \
  -vv

# v0.8 session key / 受限权限脚本
forge script script/SessionKeyPracticeV08.s.sol:SessionKeyPracticeV08 \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast \
  --legacy \
  -vv
```

注意：只使用课程专用测试网钱包，不要把私钥、助记词、`.env` 或 broadcast cache 中的敏感信息提交到仓库。

## 参考

- [Foundry Book](https://book.getfoundry.sh/)
- [Monad Foundry 部署指南](https://docs.monad.xyz/guides/deploy-smart-contract/foundry)
- [Monad Foundry 源码验证指南](https://docs.monad.xyz/guides/verify-smart-contract/foundry)
- [ERC-4337 Docs](https://docs.erc4337.io/)
