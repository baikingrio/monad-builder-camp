# 2026-07-06｜WCB / 官方共学打卡与任务 Proof 草稿

> 状态：草稿，提交 WCB 或官方共学仓库前需人工确认。  
> 公开安全检查：不包含私钥、助记词、API Key、`.env`、会议密码。

## 官方 notes/baikingrio.md 打卡内容

建议写入官方共学仓库：

```md
# 2026-07-06

<!-- DAILY_CHECKIN_2026-07-06_START -->
今天是 Monad Builder Camp 的 Day 1，我先搭建了独立学习仓库，并在 `experiments/monad-playground` 里创建了一个 Foundry 实验项目。

今天完成了一个简单 ERC20 合约 `CampToken` 的编写、部署和源码验证。合约已经部署到 Monad Testnet，地址是 `0xef694e5411A70d05270722A38Ea9Ef242E3afcf2`，部署交易是 `0x59d72a3596bc405f024b01a31a257a8ab2eed6dcb652473af924f312c53a5ff2`，并且在 MonadVision / Sourcify 上完成了 `exact_match` 源码验证。

今天最深的感受有两个：第一，Monad 测试币领水很方便，对新手非常友好，不会一开始就卡在 faucet 门槛上；第二，源码验证不需要额外 API Key，可以直接用 `forge verify-contract` 走 Sourcify / MonadVision 完成，这让合约开源和验证变得很顺滑。

对我来说，今天不只是部署了一个 ERC20，而是完整走通了 Monad Testnet 的基础开发路径：领水、部署、浏览器查看、源码验证和 README 记录。下一步我会继续做第一笔交互交易和合约读写操作，把它整理成 Week 1 的任务 proof 和 Mini Demo 0 材料。
<!-- DAILY_CHECKIN_2026-07-06_END -->
```

## WCB 任务 Proof 草稿 1：Week 1｜前置准备｜进入 Web3 与链上世界

任务 ID：`cmqns0cuonzkyph01xufn6k9l`

```text
今天完成了 Monad Builder Camp 的 Week 1 前置准备，并把过程记录在个人学习仓库中：

https://github.com/baikingrio/monad-builder-camp

我为这期训练营单独创建了学习空间，并在 experiments/monad-playground 中搭建了 Foundry 实验项目。当前使用的是 Monad Testnet：

- Chain ID: 10143
- RPC: https://testnet-rpc.monad.xyz
- Faucet: https://faucet.monad.xyz
- Explorer: https://testnet.monadvision.com

今天我实际体验了 Monad 测试币领水和区块浏览器查询。最大的感受是 Monad 的 faucet 对新手很友好，领取测试币几乎没有复杂门槛，这让学习者可以很快进入链上实践，而不是卡在准备阶段。

我也用自己的话重新理解了链上产品和普通互联网产品的区别：普通互联网产品的状态主要由中心化服务器和数据库维护，用户一般只能相信平台展示的结果；链上产品则把关键状态、交易和合约逻辑公开记录在链上，用户可以通过区块浏览器验证地址、交易、合约源码和状态变化。这样产品的可信度不只来自平台承诺，也来自可公开验证的链上记录。

相关记录：
https://github.com/baikingrio/monad-builder-camp/tree/main/experiments/monad-playground
```

## WCB 任务 Proof 草稿 2：Week 1｜AI 辅助开发｜用 AI 生成一个最小 Solidity 合约

任务 ID：`cmqomicvlo7u4ph012xcw5liw`

```text
今天在 Monad Builder Camp 学习仓库中完成了一个最小 Solidity 合约实验：CampToken。

代码位置：
https://github.com/baikingrio/monad-builder-camp/tree/main/experiments/monad-playground

合约文件：
https://github.com/baikingrio/monad-builder-camp/blob/main/experiments/monad-playground/src/CampToken.sol

CampToken 是一个简化版 ERC20，包含 name、symbol、decimals、totalSupply、balanceOf、allowance、transfer、approve 和 transferFrom 等基础能力。初始供应量是 1,000,000 CAMP。

这次练习中，我重点不是让 AI 直接替我完成开发，而是把 AI 作为辅助工具，用来帮助生成基础结构、解释 ERC20 的核心字段和函数，再由我人工检查关键点。人工检查包括：

1. transfer 是否检查余额不足；
2. transfer 是否禁止转到零地址；
3. transferFrom 是否检查并扣减 allowance；
4. _mint 是否更新 totalSupply 和接收方余额；
5. Transfer / Approval 事件是否正确触发。

我还补充了 Foundry 测试，覆盖 metadata、transfer、approve + transferFrom 三条基础路径。

测试文件：
https://github.com/baikingrio/monad-builder-camp/blob/main/experiments/monad-playground/test/CampToken.t.sol
```

## WCB 任务 Proof 草稿 3：Week 1｜智能合约实践｜部署你的第一个 Monad 合约

任务 ID：`cmqomjdtjo7vuph01nvicj1dp`

```text
今天我把第一个 Solidity 合约 CampToken 部署到了 Monad Testnet，并完成了源码验证。

代码与 README：
https://github.com/baikingrio/monad-builder-camp/tree/main/experiments/monad-playground

合约地址：
0xef694e5411A70d05270722A38Ea9Ef242E3afcf2

部署交易：
0x59d72a3596bc405f024b01a31a257a8ab2eed6dcb652473af924f312c53a5ff2

MonadVision：
https://testnet.monadvision.com/address/0xef694e5411A70d05270722A38Ea9Ef242E3afcf2

源码验证状态：
exact_match（Sourcify / MonadVision）

这次部署使用 Foundry 完成，部署脚本在：
https://github.com/baikingrio/monad-builder-camp/blob/main/experiments/monad-playground/script/DeployCampToken.s.sol

今天比较有收获的一点是，MonadVision 的源码验证可以通过 Sourcify 完成，不需要额外申请 API Key。部署后我使用类似下面的命令完成验证：

forge verify-contract \
  0xef694e5411A70d05270722A38Ea9Ef242E3afcf2 \
  src/CampToken.sol:CampToken \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/ \
  --constructor-args $(cast abi-encode "constructor(string,string,uint256)" "Camp Token" "CAMP" 1000000000000000000000000) \
  --watch

这次练习让我完整走通了：合约源码 → 编译 → 部署 → 合约地址 → 区块浏览器 → 源码验证 → README 记录。后续我会继续补充合约 read / write 交互记录。
```

## 当前建议

今天最适合优先提交：

1. 官方共学打卡内容；
2. `Week 1｜前置准备｜进入 Web3 与链上世界`；
3. 如果确认部署和验证信息都可以作为 proof，再提交 `Week 1｜智能合约实践｜部署你的第一个 Monad 合约`。

`AI 辅助开发` 任务也可以提交，但最好再补一小段原始 Prompt / AI 输出 / 人工修改记录，会更贴合任务要求。
