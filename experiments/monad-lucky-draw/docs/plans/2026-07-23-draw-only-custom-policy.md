# DrawOnly 自定义 Session Policy 实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**目标：** 在不广播、不创建 Safe 的前提下，新增两个最小 Solidity Policy，为未来 Safe 7579 + Smart Sessions 路径提供可测试的链上权限基础：只允许指定 Lucky Draw 的无参数 `draw()`、`value = 0`，并对 UserOperation 返回有效期窗口。

**架构：** 不把 target/selector、零 value 和 expiry 混成一个模糊的服务端限制。`DrawOnlyActionPolicy` 是 Action Policy，逐个 ERC-7579 action 检查固定 target、固定 selector、恰好 4 字节 calldata 和 `value == 0`。`SessionTimeWindowPolicy` 是 UserOp Policy，按 Smart Sessions 的 `ConfigId + multiplexer + account` 命名空间存储 `validAfter/validUntil`，并返回 ERC-4337 v0.7 validation data。两者须同时安装；Safe 7579 的原生 `ActionData` 也必须只列出同一个 target/selector，且不得配置 fallback action。

**技术栈：** Solidity `0.8.28`、Foundry、ERC-4337 v0.7 packed validation data、Smart Sessions v1 `IActionPolicy` / `IUserOpPolicy` ABI（固定来源：`erc7579/smartsessions@dc20f0b90541ef93e88177690b0c882384896332`）。

**非目标：** 本计划不部署、广播、创建账户、安装 Safe 模块、移除旧 Safe 的 3 次限制，亦不声称自定义 Policy 已审计。任何测试通过都只代表本地逻辑通过，不代表可上线。

---

## 安全不变量

1. `DrawOnlyActionPolicy` 必须同时拒绝错误 target、错误 selector、带参数 calldata、非零 `value`，且这些拒绝测试要相互独立。
2. Action Policy 的配置只能启用唯一的 Lucky Draw 地址 `0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70` 和 `draw()` selector `0x0eecae21`；初始化输入中任何其他值都必须 revert。
3. `SessionTimeWindowPolicy` 必须拒绝 `validUntil <= validAfter`、零 `validUntil`，并输出不可聚合的 ERC-4337 validation data。
4. 时间窗口仅由链上验证数据限制；不得用 API 的 TTL、浏览器时间或 server flag 替代。
5. 所有状态必须由 `configId + msg.sender(multiplexer) + account` 隔离；不同 Smart Sessions multiplexer 或 account 不能覆盖彼此配置。
6. `initializeWithMultiplexer` 不能做外部调用、不能接触私钥、不能持有资金、不能有 owner/admin 后门。
7. 所有未来部署脚本必须先调用 `npm run validate:safe7579-manifest`，并且当前 manifest 的 `deployment.permitted` 继续为 `false`。

## 任务 1：先写 ABI 兼容与 Policy 的失败测试

**文件：**
- Create: `contracts/test/DrawOnlyActionPolicy.t.sol`
- Create: `contracts/test/SessionTimeWindowPolicy.t.sol`
- Create: `contracts/src/interfaces/ISmartSessionPolicy.sol`

**步骤：**
1. 定义最小的本地 ABI 兼容 interface：`ConfigId`、`PackedUserOperation`、`IActionPolicy`、`IUserOpPolicy`、`IERC165`。不得复制整个第三方实现。
2. 写失败测试，期望尚不存在的两个 Policy 分别提供：
   - 正常 `draw()` + 0 value 返回 validation success；
   - target、selector、value、带参数 calldata 各自失败；
   - 初始化时错误 target / selector 失败；
   - 不同 multiplexer / account 的配置互不影响；
   - 时间窗边界、过期、尚未生效、无效窗口各自失败；
   - ABI interface selector 与固定 Smart Sessions v1 ABI 兼容。
3. 运行单个测试，确认因 contract 尚不存在而失败。

## 任务 2：实现最小 `DrawOnlyActionPolicy`

**文件：**
- Create: `contracts/src/DrawOnlyActionPolicy.sol`
- Test: `contracts/test/DrawOnlyActionPolicy.t.sol`

**实现要求：**
- `initData` 仅 ABI 解码 `(address target, bytes4 selector)`；
- 仅接受固定 Lucky Draw target 与 `draw()` selector；
- 状态按 `ConfigId => multiplexer => account => ActionConfig` 存储；
- `checkAction` 必须验证已初始化、target、`value == 0`、`data.length == 4` 和 selector；
- 不得用 `tx.origin`、不得有可提取资产或可升级入口；
- 实现 `supportsInterface`，只报告所需 interface。

**验证：**
- 先跑 Action Policy 单测；
- 再跑全部 Forge 测试；
- 不增加部署脚本。

## 任务 3：实现最小 `SessionTimeWindowPolicy`

**文件：**
- Create: `contracts/src/SessionTimeWindowPolicy.sol`
- Test: `contracts/test/SessionTimeWindowPolicy.t.sol`

**实现要求：**
- `initData` ABI 解码 `(uint48 validAfter, uint48 validUntil)`；
- 拒绝零 `validUntil` 和 `validUntil <= validAfter`；
- 状态按 `ConfigId => multiplexer => account => TimeWindow` 存储；
- `checkUserOpPolicy` 不读取或信任浏览器字段；只返回不带 aggregator 的 ERC-4337 validation data：`sigFailed=0`、配置的 `validUntil`、配置的 `validAfter`；
- 单测通过 decode / 位移明确检查返回字段；在 `vm.warp` 后分别验证 before-window、within-window、after-window 的结果语义；
- 实现 `supportsInterface`，且不能把 Action interface 错报为支持。

## 任务 4：交叉验证、文档与非广播 gate

**文件：**
- Modify: `contracts/test/DeploymentManifest.t.sol`
- Modify: `contracts/vendor-manifest.safe7579.json`
- Modify: `docs/safe7579-deployment-provenance.md`
- Create: `docs/draw-only-custom-policy-security-review.md`

**步骤：**
1. 先写 manifest 测试，要求 manifest 将自定义 Policy 标注为 `localOnly`、`auditStatus: "NOT_AUDITED"`、`deploymentEligible: false`；确认失败。
2. 更新 manifest 与文档，明确：本地 Policy 是为验证授权语义创建的项目代码，不是“已审计 / 已部署 / 可生产使用”的模块。
3. 安全审查文档必须列出：信任边界、状态隔离、每个拒绝测试、重放 / 前置 / owner 相关非覆盖范围、部署前必须完成的独立审计与实际 Smart Sessions 集成测试。
4. 运行：
   - `cd contracts && forge test -vvv`
   - `npm test`
   - `git diff --check`
5. 仅当全部通过，才提交一个不广播的 commit；不得 push 未经复核的私钥、RPC 凭据或 `.env`。

## 任务 5：双阶段审查与下一道 gate

1. 规格审查：确认每个安全不变量和每个独立拒绝路径都有测试。
2. 质量审查：检查 validation data 位编码、接口 ABI、存储隔离、无外部调用、无权限提升、无部署能力。
3. 只有两轮审查均通过，才可将本地 Policy 标为“本地测试完成”。
4. 进入任何测试网部署前，必须另行提供：第三方 / 自定义合约审计范围、完整 bytecode hash、dry-run 输出、待发交易清单、发起 EOA、资金来源和明确用户广播授权。
