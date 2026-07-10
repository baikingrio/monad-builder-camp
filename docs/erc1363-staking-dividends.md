# ERC-1363 质押收益分红实践

资料来源：[EIP-1363](https://eips.ethereum.org/EIPS/eip-1363)。

## ERC-1363 的核心

ERC-1363 在 ERC-20 之上增加“转账或授权完成后，立即回调目标合约”的能力。它依赖 ERC-165 做接口发现。

本次实践用到：

- `transferAndCall(address to, uint256 value, bytes data)`：代币先转给 `to`，然后调用接收方的 `onTransferReceived`。
- `transferFromAndCall(...)`：由被授权 spender 发起同样的转账和回调。
- `approveAndCall(...)`：授权后调用 spender 的 `onApprovalReceived`。
- ERC-1363 interface id：`0xb0202a11`。
- 接收方必须返回 `onTransferReceived(address,address,uint256,bytes)` 的 selector，即 `0x88a7ca5c`；否则整个交易回滚。

这种“转账 + 业务动作”原子化很适合质押：用户不用先 `approve`，再调用 `stake(amount)`，而是在一次 `transferAndCall` 中将 SRT 转到 Vault 并完成记账。

## 合约设计

### StakeRewardToken

`StakeRewardToken` 是一个学习版 ERC-20 / ERC-1363 Token：

- 兼容普通 `transfer`、`approve`、`transferFrom`。
- 支持 ERC-165 与 ERC-1363 interface id。
- 对 `transferAndCall`、`transferFromAndCall`、`approveAndCall` 验证目标必须为合约，且回调必须返回对应 magic value。
- 目标回调 revert 或返回错误 selector 时，EVM 会回滚转账或授权，避免 Token 已转出但业务记账失败。

### ERC1363StakingDividendVault

Vault 只接受配置好的 `StakeRewardToken` 回调：

- 空 `data`：作为用户质押，增加 `stakedBalance` 和 `totalStaked`。
- `abi.encode(uint8(1))`：仅 owner 可以作为奖励注入；按 `accRewardPerShare` 记录每份质押可分得的累计收益。
- `claim()`：把用户已累计、但未领取的收益转回用户。
- `withdraw(amount)`：先结算旧收益，再减少质押；用户不会因提取本金丢失历史收益。

关键限制：

- 错误 Token 回调会拒绝。
- 没有任何质押时，不能注入奖励，避免奖励没有归属。
- 非 owner 不能伪装成奖励注入。
- 使用简单 reentrancy lock，保护回调、领取和提取过程。

## 测试网真实证明

- Token：`0x37AFF878FB6b6f4bdDcC6629a5Be46060f526531`
- Vault：`0xeF0dDBa411E5586C0B441A068EAAe77a4552B7a7`

真实流程：

1. `transferAndCall(vault, 100 SRT, 0x)`：质押。
2. `transferAndCall(vault, 20 SRT, abi.encode(uint8(1)))`：注入分红。
3. `claim()`：领取 20 SRT 收益。

交易链接见前端 README。执行后 Vault 保留 `100 SRT` 本金，用户的 `pendingRewards` 回到 `0`，说明奖励已经结算且领取成功。

## 前端使用

Nuxt 页面：`/erc1363`

- 连接 Monad Testnet 钱包。
- 读取 SRT 余额、已质押量、待领取收益。
- 填写数量后点击质押，钱包会签名 `transferAndCall`。
- 点击领取分红或提取质押，钱包会签名 Vault 调用。
- 页面显示提交后的 MonadVision 交易链接。

注意：仅测试网使用；Token 初始供应归部署账户，其他测试账号需先获得测试 SRT。
