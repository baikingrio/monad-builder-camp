# Safe 7579 / Smart Session 依赖溯源记录

**状态：禁止部署。** 本文锁定了可复核的上游源码与字节码哈希，同时明确记录尚未满足的授权合约前置条件。它不是部署许可，也不代表 Monad 上已存在这些合约。

## 已锁定的上游来源

### Safe 7579 v2

- 仓库：`rhinestonewtf/safe7579`
- Tag：`v2.0.0`
- Commit：`40d92beeb423ec6a94d5667350086148df8b170c`
- 固定源码：[GitHub tree](https://github.com/rhinestonewtf/safe7579/tree/40d92beeb423ec6a94d5667350086148df8b170c)
- 合约：`Safe7579.sol`、`Safe7579Launchpad.sol`
- SPDX：`GPL-3.0`
- 已发布 artifact 的编译器：`solc 0.8.28+commit.7893614a`，`cancun`
- 上游部署资料：`Deploy.toml`、`script/Deploy.s.sol`、`script/DeployAccount.s.sol`
- Launchpad 依赖：EntryPoint v0.7 `0x0000000071727De22E5E9d8BAf0edAc6f37da032`；Registry `0x000000000069E2a187AEFFb852bF3cCdC95151B2`。

### Smart Sessions v1 与 Universal Action Policy

- 仓库：`erc7579/smartsessions`
- Tag：`v1.0.0`
- Commit：`dc20f0b90541ef93e88177690b0c882384896332`
- 固定源码：[GitHub tree](https://github.com/erc7579/smartsessions/tree/dc20f0b90541ef93e88177690b0c882384896332)
- 该 release 自称为 audited v1.0.0 production release；对应审计报告保存在仓库 `audits/`。
- `SmartSession.sol` 的 SPDX：`AGPL-3.0-only`。
- `UniActionPolicy.sol` 的 SPDX：`MIT`。
- 已发布 artifact 的编译器：`solc 0.8.28+commit.7893614a`，`cancun`。

所有文件 SHA-256 与 creation/runtime keccak256 都写入 [`contracts/vendor-manifest.safe7579.json`](../contracts/vendor-manifest.safe7579.json)，由 Foundry 测试固定校验。

## 项目内自定义 Policy：仅本地、未审计

下列项目代码只记录其源码路径，**不**属于上述上游 release、artifact 哈希或审计结论：

- `src/policies/DrawOnlyActionPolicy.sol`
- `src/policies/SessionTimeWindowPolicy.sol`

manifest 对两者均固定为 `localOnly: true`、`auditStatus: "NOT_AUDITED"`、`deploymentEligible: false`。这些字段是 fail-closed 分类，不是部署、审计或生产可用性声明；没有为自定义 Policy 记录 artifact、bytecode hash、部署地址或发布溯源。详见[自定义 Policy 安全审查](draw-only-custom-policy-security-review.md)。

## Monad Testnet 结论

在此前只读 `eth_getCode` 检查中，下列惯用跨链地址在 Monad Testnet（chain ID `10143`）均返回 `0x`：

- Safe 7579 Launchpad v2：`0x75798463024bda64d83c94a64bc7d7eab41300ef`
- Safe 7579 Adapter v2：`0x7579f2ad53b01c3d8779fe17928e0d48885b0003`
- Smart Session Emissary：`0xad568b3f825a8d5ffc06dd3253526b64d810ae89`
- Universal Action Policy：`0x0000006dda6c463511c4e9b05cfc34c1247fcf1f`
- Time Frame Policy：`0x8177451511de0577b911c254e9551d981c26dc72`
- Value Limit Policy：`0xa09b47de6e510cbdc18b97e9239bedcb44fb4901`

这些地址不是 Monad 可复用部署；不得把其他链的地址当作 Monad 部署结果。

## 阻断项：Time Frame / Value Limit Policy

在已固定的 `smartsessions v1.0.0` 源码中，`TimeFramePolicy.sol` 与 `ValueLimitPolicy.sol` 只位于 `test/mock/`。该 release 没有为这两个合约提供 production artifact、发布说明或可接受的部署溯源。

这意味着它们不能作为 Lucky Draw 的部署依赖：

- 不能把 mock/test 合约复制到项目里后当作已审计授权合约；
- 不能为了复现地址而部署未经审查的第三方授权代码；
- 不能只依赖服务端 TTL 或次数限制来代替链上权限边界；
- 在完整的、经审查并固定版本的 expiry / value-zero policy 被选定前，禁止创建新的 7579 Safe、安装 Session 或广播部署交易。

`vendor-manifest.safe7579.json` 因此将 `deployment.permitted` 固定为 `false`，且所有 blocker 均为 `false`。`npm run validate:safe7579-manifest` 会验证该状态、四个指定 blocker、完整哈希和抽卡边界；`forge test` 会单独运行 Foundry manifest 测试及自定义 Policy 的 fail-closed 分类。任何未来新增的 7579 部署、建账户或安装 Session 脚本都必须先调用这个 manifest gate，且只有在独立审计、实际集成、dry run 和明确广播授权完成后才可以修改其阻断状态。

## 可以继续的非广播工作

- 对已锁定 artifact 做本地重编译、哈希和 ABI/selector 对照；
- 继续检索具有发布溯源与审计材料的 expiry/value 限制策略；
- 在新依赖通过审查后，才建立使用真实合约的本地策略 harness。

在此之前，旧 Safe 的三次/24 小时服务端保护保持不变；不会创建账户、转移余额或广播链上交易。
