# Pyth BTC/USD Probe｜Monad Testnet 链上 Proof

> 这是为 15 分钟 BTC/USD 涨跌预测方向做的 Oracle 验证实验，不是预测市场结算合约，也不处理真实资产。

## 目标

确认 Pyth Pull Oracle 能否在 Monad Testnet 上完成完整链路：从 Pyth Hermes 取得签名更新数据，在链上支付更新费、验证更新，然后读取并保存新鲜的 BTC/USD 价格、置信区间和发布时间。

## 合约与部署

- 网络：Monad Testnet（Chain ID `10143`）
- Probe：[`PythBtcPriceProbe`](https://testnet.monadvision.com/address/0x8fB960b58f965Fa2ee69fd2b12A1F05Bfb5Ce369)
- 部署交易：[`0x5799612718547ce114d7e0c9fbff4725344625ee608b573ebb16d4fd41e1829b`](https://testnet.monadvision.com/tx/0x5799612718547ce114d7e0c9fbff4725344625ee608b573ebb16d4fd41e1829b)
- Pyth 主合约：`0x2880aB155794e7179c9eE2e38200202908C17B43`
- BTC/USD Price ID：`0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`
- `maxPriceAge`：`60` 秒

## 真实更新结果

调用 `updateAndRecord(bytes[] updateData)` 的交易：

- [`0xcaca6f5f1ae8b4f30ce22f62fcee66f57512aa509c5444ed5b824eefc1f2e7c0`](https://testnet.monadvision.com/tx/0xcaca6f5f1ae8b4f30ce22f62fcee66f57512aa509c5444ed5b824eefc1f2e7c0)
- 状态：成功
- Gas：`527136`
- Pyth update fee：`1 wei`
- Pyth `publishTime`：`2026-07-25 13:11:03 UTC`
- 记录的 BTC/USD：`64064.02499999`
- 记录的置信区间：`±16.09499999 USD`
- 指数：`-8`

该交易同时产生 Pyth 的价格更新事件和 Probe 的 `PriceRecorded` 事件。

## 合约边界

Probe 只做以下事情：

1. 根据传入的 Pyth 更新数据查询准确 update fee；
2. 要求调用者支付精确 fee，拒绝多付和少付；
3. 调用 `updatePriceFeeds` 让 Pyth 在链上验证签名价格；
4. 用 `getPriceNoOlderThan` 按 `maxPriceAge` 读取 BTC/USD；
5. 拒绝非正价格，并记录价格、置信区间、指数和发布时间。

它不包含下注、奖池、赔率、结算或领奖逻辑。预测市场需要在此基础上单独定义 Round 时间窗、封盘、价格新鲜度、超时取消和 Claim 规则。

## 本地验证

```text
forge test -vvv
58 passed, 0 failed
```

Probe 的专项测试覆盖：成功记录经更新验证的价格、update fee 不匹配拒绝、非正价格拒绝。
