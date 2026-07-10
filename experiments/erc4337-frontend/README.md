# Monad ERC-4337 / ERC-1363 实验前端

这是 Monad Builder Camp 的 Nuxt 4 全栈学习项目，用来把 Foundry 中完成的账户抽象和代币回调实验整理成可连接钱包、可查看链上 proof、可在 Monad Testnet 发起测试交易的前端。

> 只面向 Monad Testnet（Chain ID `10143`）和测试代币。合约是学习用途，不可用于主网或真实资产。

## 当前内容

### ERC-4337 学习模块

首页 `/` 展示三组已完成的 ERC-4337 实验，并提供可逐步点击的应用场景说明：

- Counterfactual deployment / `initCode`
- Paymaster / sponsored UserOperation
- Session Key / 受限权限

页面能连接浏览器钱包、读取 Monad Testnet 余额，并跳转 MonadVision 查看已完成实验的真实 proof。

### ERC-1363 质押分红模块

页面 `/erc1363` 实践 [EIP-1363](https://eips.ethereum.org/EIPS/eip-1363) 的 `transferAndCall`：

1. 用户调用 `token.transferAndCall(vault, amount, 0x)`。
2. Token 转账后立即回调 Vault 的 `onTransferReceived`。
3. Vault 确认回调来自指定 Token 后，把这笔代币记为用户质押。
4. 合约 owner 使用 `transferAndCall` 并附带奖励标识，为所有质押者注入分红。
5. 质押者可以调用 `claim()` 领取累计收益，或调用 `withdraw(amount)` 提取本金；提取前会先保留已经累计的收益。

该模块已接入浏览器钱包真实写入操作：

- 质押：`transferAndCall(vault, amount, 0x)`
- 领取分红：`vault.claim()`
- 提取质押：`vault.withdraw(amount)`

每笔操作都要求用户的钱包确认，页面会展示 MonadVision 交易链接。

## ERC-1363 Testnet 部署

- StakeRewardToken（SRT）：`0x37AFF878FB6b6f4bdDcC6629a5Be46060f526531`
  - [部署交易](https://testnet.monadvision.com/tx/0x614f0e1709b7002eaa7a4355005a25964530ff61b0924ea9a12cbf4978c67e1b)
- ERC1363StakingDividendVault：`0xeF0dDBa411E5586C0B441A068EAAe77a4552B7a7`
  - [部署交易](https://testnet.monadvision.com/tx/0x0b6a495dd00c047b6c35c52df258bcc46b1145d4e4ed92d4eaf366373238ac26)

已完成一组真实链上练习：

- [质押 100 SRT](https://testnet.monadvision.com/tx/0x00ef8989ef50c9dce3c9dca10a779514840e599f752537a1045bca0833885064)
- [注入 20 SRT 分红](https://testnet.monadvision.com/tx/0x0b38eb7af2438d28aa5d762d877adffced06dca600e00ea25015fd3a15f6769c)
- [领取分红](https://testnet.monadvision.com/tx/0x81a07ccccd3c48e248ea65440f41ae9a891b6dc2da7b6794387d963b7488e4e4)

执行后的链上状态：

```text
stakedBalance = 100 SRT
pendingRewards = 0 SRT
vault token balance = 100 SRT
```

> 初始 SRT 全部归部署账户。其他测试钱包需要先获得 SRT，才能在 `/erc1363` 页面质押；请只使用测试网账户和测试代币。

## 技术架构

```text
Nuxt 4
├── app/pages/             # 浏览器页面与钱包交互
├── app/lib/               # Viem / Wagmi、ABI、金额校验、实验数据
├── server/api/            # Nitro API，例如 /api/health
└── server/utils/          # 服务端纯逻辑与私有运行时配置

Foundry
├── StakeRewardToken.sol               # ERC-20 + ERC-1363 callback token
├── ERC1363StakingDividendVault.sol    # 回调质押与按份额分红
└── ERC1363StakingPractice.s.sol        # 测试网真实质押、注资、领取脚本
```

## 开发

```bash
cd experiments/erc4337-frontend
npm install
npm run dev
```

默认开发地址会由 Nuxt 输出。打开：

- `/`：ERC-4337 实验页
- `/erc1363`：ERC-1363 质押分红页
- `/api/health`：Nitro 健康检查

## 环境变量

复制 `.env.example` 后按需配置：

```bash
cp .env.example .env
```

- `NUXT_RELAY_URL`、`NUXT_RELAY_API_KEY`：后续 ERC-4337 Relay 使用的服务端私有配置，不能暴露为 `NUXT_PUBLIC_`。
- `NUXT_PUBLIC_ERC1363_TOKEN_ADDRESS`、`NUXT_PUBLIC_ERC1363_VAULT_ADDRESS`：只在需要覆盖默认 Monad Testnet 部署地址时设置；它们是公开合约地址，不是密钥。

不要提交 `.env`、私钥、API Key、Foundry `broadcast/` 或 `cache/` 文件。

## 验证

Nuxt：

```bash
npm test
npm run build
```

Foundry：

```bash
cd ../monad-playground
forge test
forge test --match-path test/ERC1363StakingDividendVault.t.sol -vv
```

ERC-1363 测试覆盖：

- ERC-165 / ERC-1363 interface id
- `transferAndCall` 接收方 magic value 与回滚
- callback 自动质押
- 按份额分红与不可重复领取
- 提取本金后收益保留
- 未授权奖励注入、无质押奖励、错误 Token 等拒绝路径
