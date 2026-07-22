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
