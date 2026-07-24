# MonadLuckyDraw Solidity workspace

本目录包含 `MonadLuckyDraw` 学习合约、Foundry 测试与部署脚本。合约为 Monad Testnet 演示用途提供无费用的抽卡：`draw()` 为调用者递增抽卡次数，并返回 0 至 2 的稀有度。

## 重要限制

稀有度由 `block.prevrandao` 与调用者、抽卡次数派生。该伪随机性可被操纵，仅限学习和演示，绝不可用作生产环境随机数。

## 本地验证

在此 `contracts/` 目录中运行：

```sh
forge test
forge build
```

可按以下命令对 Monad Testnet RPC 执行部署脚本的默认 dry-run：

```sh
forge script script/DeployMonadLuckyDraw.s.sol:DeployMonadLuckyDraw --rpc-url https://testnet-rpc.monad.xyz -vv
```

未经用户明确批准，绝不添加或使用 `--broadcast`。本仓库尚未执行部署或广播。

## Zodiac Roles（下一产品路径，fail-closed）

- Manifest：`vendor-manifest.roles.json`（`deployment.permitted=false`）
- 脚本：`script/VerifyRolesStack.s.sol`、`script/DeployRolesStack.s.sol`（默认禁止广播）
- 本地 harness：`test/DrawOnlyRolesHarness.t.sol`（**不是**上游 Roles bytecode）
- 产品门闩与 runbook：见 `../docs/zodiac-roles-migration-runbook.md`

Safe7579 相关脚本与 Policy **已归档**，不再作为产品下一跳。
