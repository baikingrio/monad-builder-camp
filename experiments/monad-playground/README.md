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
```

注意：只使用课程专用测试网钱包，不要把私钥、助记词、`.env` 或 broadcast cache 中的敏感信息提交到仓库。

## 参考

- [Foundry Book](https://book.getfoundry.sh/)
- [Monad Foundry 部署指南](https://docs.monad.xyz/guides/deploy-smart-contract/foundry)
- [Monad Foundry 源码验证指南](https://docs.monad.xyz/guides/verify-smart-contract/foundry)
- [ERC-4337 Docs](https://docs.erc4337.io/)
