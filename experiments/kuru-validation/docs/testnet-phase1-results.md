# Kuru Phase 1–2 Monad Testnet 实测结果

> **执行模式：** 真实 Monad Testnet 广播。使用课程测试账户支付 Test MON Gas；仅部署并使用 Mock ERC-20，不涉及主网、真实 USDC 或真实资金。
>
> **结论：** Kuru 可以承载自定义 Outcome Token 的充值、链上限价单、跨地址成交、提现与 OutcomeVault 赎回；但 Kuru Market 的生命周期不受 Target Sprint / OutcomeVault 控制，结算后仍可交易。因此官方 Kuru Router 直接集成不满足预测市场强制 Cutoff 的安全要求。

## 网络与官方协议

| 项目 | 值 |
|---|---|
| 网络 | Monad Testnet |
| Chain ID | `10143` |
| 官方 Kuru Router | `0x7EFbE105Ca7415dE98F96622173458ac1c054630` |
| 官方 Margin Account | `0xd029C2D98ff85D8F64799017fE00a59B1159CE02` |

## 本次部署

| 组件 | 地址 | 部署交易 |
|---|---|---|
| Two Trader Test USDC | `0x0770F1bBD69DCa914af3B95d7368EE2bC0fDEf8B` | [`0x38ad…7beb`](https://testnet.monadvision.com/tx/0x38ad4a1e7817082cbb85f314ca8c3aad921fb518bc8ea9dd0fa9e8959cc7beb0) |
| OutcomeVault | `0xb40Fa77e222700623f06be791bb7f14A71e1e00f` | [`0x25fb…4b57`](https://testnet.monadvision.com/tx/0x25fb199a4816e7bb1049dcd73f5ec6424f8dbb8cd1934006dfa083e319e34b57) |
| Above Outcome Token | `0x7efF69E18a852765A9B83Bf5903ef679E1b44049` | OutcomeVault constructor 内部创建 |
| Below Outcome Token | `0x322b3f75CE53B4Ee1dA21450f67E1fe8395d532F` | OutcomeVault constructor 内部创建 |
| Kuru `Above / ttUSDC` Market | `0x386C126266644E8CAB0bB6c5E0f23b6eC53C92D7` | [`0xd3c8…117c`](https://testnet.monadvision.com/tx/0xd3c8ca59bbf88884acb35d1cb2d5e21f87a4c26f9a3184677902148ecb18117c) |
| Alice 测试 Actor | `0xd5C375dCB6F4dfB4e5D7cC6fa1Ee1b327549c4d7` | OutcomeVault 同批部署 |
| Bob 测试 Actor | `0xc52C765b25e5d13C7249604500b808CC3bb4C237` | OutcomeVault 同批部署 |

Kuru Market 创建交易已由 Router 成功确认，receipt `status = 0x1`，`gasUsed = 2,155,860`。

## 已实测的完整路径

### 1. 两个独立 Actor 的 Kuru 订单成交

```text
Alice
  → 获得 60 ttUSDC
  → Deposit 到 Kuru Margin Account
  → Buy 100 Above @ 0.60

Bob
  → 获得 100 ttUSDC
  → OutcomeVault Split 100 ttUSDC
  → 获得 100 Above + 100 Below
  → Deposit 100 Above 到 Kuru Margin Account
  → Sell 100 Above @ 0.60

Kuru
  → Alice 买单与 Bob 卖单成交
```

| 动作 | 交易 | Receipt |
|---|---|---|
| Alice 限价买入 | [`0xcfb0…33f5`](https://testnet.monadvision.com/tx/0xcfb0b33a32ba207a8303fb53ac829a2e67f6f4191a81f475c752c9c5ea9633f5) | `status=0x1`，gas `559,109` |
| Bob 限价卖出并成交 | [`0x9ddf…bd5a`](https://testnet.monadvision.com/tx/0x9ddf399da5de6a5193621321e98af1d563d883b1c74dc9daf3817cdcce06bd5a) | `status=0x1`，gas `516,643` |

这证明自定义 Outcome Token 能进入 Kuru Margin Account，并能由不同合约地址的用户在 Kuru 上完成链上现货撮合。

### 2. 从 Kuru 提取 Outcome Token 后赎回

```text
Alice
  → 从 Margin Account Withdraw 100 Above
  → Approve OutcomeVault
  → OutcomeVault Resolve Above
  → Redeem 100 ttUSDC
```

| 动作 | 交易 | Receipt |
|---|---|---|
| Resolve Above | [`0x544c…118a`](https://testnet.monadvision.com/tx/0x544c89ecf43426d31e9f815d22c42a6a60c4d271497827f6221d72167818118a) | `status=0x1`，gas `67,272` |
| Alice Redeem | [`0xc6b7…3930`](https://testnet.monadvision.com/tx/0xc6b7ffa1ea5149f2f565ae7100698e942eea048a7abd434fa1dbd47da3a13930) | `status=0x1`，gas `237,595` |

结算后链上读取结果：

```text
OutcomeVault.outcome() = 1 (Above)
OutcomeVault ttUSDC balance = 0
Above totalSupply = 0
```

因此该获胜份额已被销毁，抵押已完成兑付。

### 3. 结算后 Kuru 仍可下单：关键失败验证

OutcomeVault 完成 `Above` 结算后，Alice 重新向 Kuru Margin Account 充值 10 ttUSDC，并成功提交新的 Buy Above 订单：

- [`0x0c13…ec05`](https://testnet.monadvision.com/tx/0x0c13ca3ecd20930d864b08b6e9dffe5e79d8d1a003505081c1d9e9a10828ec05)
- Receipt：`status=0x1`，gas `558,958`

结算后读取：

```text
Kuru marketState() = 0 (ACTIVE)
```

这不是实现错误，而是直接集成的核心安全阻塞：**OutcomeVault 的 `Settled` 状态不会改变 Kuru Market 的 `ACTIVE` 状态。**

## 暂停权限验证

项目部署账户对官方 Router 调用：

```solidity
toggleMarkets([market], SOFT_PAUSED)
```

使用只读 `eth_call` 得到：

```text
execution reverted, data: 0x82b42900
```

即项目方没有官方 Router 的 owner 权限，不能独立将 Market 切入 `SOFT_PAUSED`。

## 决策矩阵更新

| 必要能力 | Kuru 直接集成实测 | 是否满足 Target Sprint |
|---|---|---|
| 自定义 ERC-20 市场创建 | ✅ | ✅ |
| Margin Account Deposit / Withdraw | ✅ | ✅ |
| 独立 Alice / Bob 链上订单成交 | ✅ | ✅ |
| Outcome Token 提取与 Vault Redeem | ✅ | ✅ |
| 到期前项目方独立停止新成交 | ❌ | ❌ |
| Settlement 后自动 / 可控停市 | ❌ | ❌ |

## 最终结论

```text
Official Kuru Integration: No-Go
```

直接接入官方 Kuru 的前提缺失不是流动性或 SDK，而是**市场生命周期控制权**。

下一步建议优先级：

1. 继续保留本实验，作为“Kuru 在 Outcome Token 交易与退出层可行”的链上 Evidence；
2. Target Sprint 正式 MVP 不直接依赖 Kuru 处理 Cutoff；
3. 在本地 PoC 基础上实现 Prediction-native Complementary Buy Match；
4. 若 CLOB 范围超出 Hackathon 周期，回退到 Complete Set + 协议 AMM；
5. 只有在 Kuru 官方提供 Market-level pause delegation / owner delegation 的链上证明后，才重新评估官方 Kuru 集成。
