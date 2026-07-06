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

## 参考

- [Foundry Book](https://book.getfoundry.sh/)
- [Monad Foundry 部署指南](https://docs.monad.xyz/guides/deploy-smart-contract/foundry)
- [Monad Foundry 源码验证指南](https://docs.monad.xyz/guides/verify-smart-contract/foundry)
