# DrawOnly 自定义 Session Policy 安全审查（本地代码）

**状态：仅本地验证，未审计，禁止部署。**

本文覆盖项目内 `DrawOnlyActionPolicy.sol` 与 `SessionTimeWindowPolicy.sol` 的当前本地实现。两者在 `contracts/vendor-manifest.safe7579.json` 中均被 fail-closed 标记为 `localOnly: true`、`auditStatus: "NOT_AUDITED"`、`deploymentEligible: false`。这不是审计报告、部署许可或生产就绪声明。

未发生任何部署，也**尚未与 Safe 或 Smart Sessions 进行实际集成**：未创建 Safe、未安装模块或 Session、未广播 UserOperation 或交易，亦没有可引用的部署地址、字节码哈希或链上运行记录。

## 设计边界与信任边界

- **Policy 逻辑边界：** `DrawOnlyActionPolicy` 的本地语义是仅允许固定 Lucky Draw 目标 `0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70`、`draw()` selector `0x0eecae21`、零 `value` 和恰好四字节 calldata。它不验证上层 Safe、Session 或 bundler 的实现正确性。
- **配置调用方边界：** 初始化和检查以 `msg.sender` 作为 Smart Sessions multiplexer 身份；正确的调用者认证、Session 安装、签名验证和撤销语义依赖未来真实的 Safe/Smart Sessions 集成，当前未验证。
- **账户与配置边界：** 配置按 `ConfigId + multiplexer + account` 三元组隔离。该隔离是本地代码属性，不替代上游协议对 config ID 生命周期、授权或重放的保证。
- **时间边界：** `SessionTimeWindowPolicy` 只返回 ERC-4337 v0.7 validation data；时间解释、EntryPoint/Smart Sessions 对该返回值的消费，以及链上时间戳行为仍是未集成的外部依赖。浏览器、API TTL 和服务端标记不是链上授权边界。
- **链与运维边界：** Monad 上的依赖代码、账户配置、RPC/bundler 行为、密钥保管、资金、交易构造和广播均不在本地单测覆盖范围内。

## 接口与 validation-data 打包依赖

两个 Policy 使用本地最小接口定义以匹配固定的 Smart Sessions v1 ABI；该兼容性不是实际集成证明。尤其 `SessionTimeWindowPolicy` 依赖 ERC-4337 v0.7 validation-data 编码：无 aggregator 的低 160 位、`validUntil << 160` 与 `validAfter << 208`。本地测试解码并检查这些位域，但尚未通过真实 EntryPoint、Safe 7579 或 Smart Sessions 执行路径验证。

因此，接口 selector、参数 ABI、validation-data packing 或上游版本行为的任何偏差都必须在独立集成环境中重新验证；不能根据本地返回值推断交易会被接受或拒绝。

## 已有本地拒绝与隔离测试

测试只独立验证本地代码的拒绝路径，不能作为审计替代：

- `DrawOnlyActionPolicy.t.sol` 分别拒绝错误 target、错误 selector、非零 `value`、超过四字节的 calldata、错误初始化 target 和 selector；还分别拒绝不同 multiplexer、account 与 config ID 对已配置状态的访问。
- `SessionTimeWindowPolicy.t.sol` 分别拒绝零 `validUntil`、相等窗口和反向窗口；并检查不同 multiplexer、account 与 config ID 返回 validation failure，以及窗口生效前、窗口内和过期后的本地解码语义。
- 两份测试都验证配置存储的三元组隔离，避免一个本地测试配置被另一个 multiplexer、账户或 config ID 复用。

## 明确未覆盖的风险

- UserOperation、nonce、签名、Session key、账户模块安装与撤销的重放/前置交易风险；
- Safe、Smart Sessions、EntryPoint、bundler、paymaster 或 RPC 的真实调用顺序、权限和失败语义；
- owner、guardian、upgrade、module 管理或外部系统可能扩大权限的路径；
- 部署初始化竞争、地址确定性、字节码一致性、链重组、gas 与资金风险；
- 跨策略组合是否完整强制 `draw()`、时间窗及零 value。

## 部署前不可跳过的 gate

在 manifest 的 `deployment.permitted` 仍为 `false` 时，不得部署、集成或广播。任何将来改变该状态的提案必须按顺序完成并留下可复核证据：

1. 对两份自定义 Policy 及其实际配置/调用路径完成**独立安全审计**，并处理审计发现；
2. 在隔离环境完成与真实、版本固定的 Safe 7579、Smart Sessions、EntryPoint 和相关依赖的**实际集成测试**；
3. 使用最终 artifact、配置、链 ID、调用者和交易列表执行可复核的**dry run**，验证拒绝与允许路径；
4. 在任何可广播操作前取得范围、发起地址、资金来源和每笔交易的**明确广播批准**。

上述 gate 全部完成之前，本地测试通过仅表示本地逻辑在测试 harness 中符合预期；它不授权部署或生产使用。