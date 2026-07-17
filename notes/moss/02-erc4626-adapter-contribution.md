# Moss 学习 02｜ERC-4626 Adapter 贡献调研与设计草案

> 状态：本地研究草案，尚未向 Moss Issue 或上游仓库发表意见、创建分支或提交代码。
>
> 目标：按 Moss 当前贡献规范，先确认 ERC-4626 的架构范围，再选择一个不与现有 PR 冲突的最小贡献。

## 1. 为什么关注 ERC-4626

ERC-4626 是“代币化金库（Tokenized Vault）”标准。可以把它理解为：

```text
存入资产（asset）→ 收到金库份额（share）
赎回份额（share）→ 取回资产（asset）
```

它是 Monad 上许多借贷和收益协议的共同基础。例如 Moss 的：

- [Morpho vaults Issue #9](https://github.com/nishuzumi/moss/issues/9)；
- [Euler v2 lending Issue #10](https://github.com/nishuzumi/moss/issues/10)；
- [ERC-4626 interface-layer Issue #13](https://github.com/nishuzumi/moss/issues/13)。

如果 Moss 有可靠的 ERC-4626 基础能力，后续协议 Adapter 就能复用 asset / share、存入、取回、换算与 Receipt 的共通逻辑，而不必各自重新实现一遍。

## 2. 当前上游状态核对

### 已合入的 Moss 架构

当前 `main` 的核心框架来自已合并的 PR [#31](https://github.com/nishuzumi/moss/pull/31)：

- Protocol package 以顶层自描述 `@Protocol` class 导出；
- Registry 通过显式依赖注入组合 Protocol；
- 每个 Capability 只拥有一笔直接未签名交易和一个 Receipt parser；
- Simulator 从 `debug_traceCall` 提取有序 Change；
- Receipt 必须完整、有序并按对象身份覆盖原始 Change；
- `@themoss/erc` 保持**无固定地址**；协议专属地址与 ABI 语义由协议包拥有。

目前有效的架构决策以：

- [ADR 0010：自描述 Protocol 与依赖组合](https://github.com/nishuzumi/moss/blob/main/docs/adr/0010-self-describing-protocols-and-zod-parameters.md)
- [ADR 0011：Capability Tree 与完整 Receipt](https://github.com/nishuzumi/moss/blob/main/docs/adr/0011-capability-trees-and-exhaustive-receipts.md)

为准。

### Issue #13 的历史设计需要重新确认

Issue #13 提到的 ADR 0009 文件已经不在当前 `main` 的 `docs/adr/` 中。它引用的是 PR #31 重构之前的“manifest-time instantiation”方案。

这不是抽象的担忧，而是已有直接先例：被关闭的 [ERC-1155 PR #23](https://github.com/nishuzumi/moss/pull/23) 曾基于旧的 Plan / flows / expects / effects / reconciliation 模型开发。Maintainer 在 #31 合并后明确要求它不能原样合并，必须从当前 `main` 重建为：

- 自描述的 address-free ERC-1155 `@Protocol`；
- typed Capability / Query；
- 对原始有序 Change 做穷尽解析的 typed Receipt；
- ERC 专属规则留在 `@themoss/erc`；
- valid / invalid compile fixture 与有序 Receipt coverage 测试。

作者随后重建为 [PR #68](https://github.com/nishuzumi/moss/pull/68)。#68 没有恢复旧的 Plan / reconciliation 代码，而是遵循新框架：一个 `transfer` Capability、一笔直接交易、typed Receipt、`TransferSingle` / `TransferBatch` 的精确有序 Change 覆盖，以及主网零 Warning 模拟。

因此，不能直接按 #13 中旧的 `instantiate(Erc4626Protocol, { name, addr })` 设计开始编码。当前正确做法是：

> 先在 Issue #13 与 maintainer 确认：在新的自描述 Protocol + 显式依赖注入框架中，ERC-4626 应采用什么组合方式。

这不是拖延，而是在遵守 CONTRIBUTING.md 中“读取当前 ADR、不要兼容未提交的中间设计、删除被替代的设计”的要求。

## 3. Kuru Adapter 提供的可复用经验

阅读 [Kuru Adapter](https://github.com/nishuzumi/moss/blob/main/packages/protocols/kuru/src/kuru.ts) 与其测试后，归纳出一个 Adapter 的最小质量模型：

1. `@Protocol` 写明名称、类别、描述、合约 Handle 和依赖；
2. 每一个参数都分为可复用的 Zod 类型契约与当前字段说明；
3. `Query` 与 `Capability` 分开；
4. ERC-20 授权作为嵌套 Capability，而不是隐藏交易；
5. Receipt 只从有序 Change 得出结论，不根据原计划或外部状态补全事实；
6. 测试覆盖正常路径、错误路径、参数边界、Receipt 顺序和完整覆盖；
7. 最后以 Monad Mainnet 的零 Warning 模拟做 E2E 证据。

ERC-4626 若有 `deposit` / `withdraw` 等写操作，也应达到同样标准。

## 4. ERC-4626 的潜在最小能力

以下只是设计选项，不是已获 Moss 批准的 API。

### 查询（较低风险）

```text
asset(vault)
shareBalance(vault, owner)
assetBalance(vault, owner)
convertToShares(vault, assets)
convertToAssets(vault, shares)
previewDeposit(vault, assets)
previewRedeem(vault, shares)
```

### 写操作（需要 Receipt 与模拟）

```text
supply / deposit
withdraw
redeem
```

参数需要明确：

- vault 地址来源或绑定方式；
- asset / share 的显示精度；
- 输入是资产数量还是份额数量；
- receiver / owner 是否允许与调用账户不同；
- 允许的最大支出或最小收到份额；
- 是否需要嵌套 ERC-20 `approve`。

Receipt 至少需要完整解释：

- ERC-20 asset 从用户到 vault 的流出；
- ERC-20 share 从 vault 到 receiver 的流入；
- `Deposit` / `Withdraw` event；
- 若存在嵌套授权，则由 ERC Adapter 解释授权 Change。

## 5. 与 Morpho / Euler / Pendle 的关系

### Morpho #9

[Morpho PR #49](https://github.com/nishuzumi/moss/pull/49) 正在实现一个受限的、只读第一步：

- 只支持一个 curated AUSD MetaMorpho vault；
- 只提供 `position({ owner })` Query；
- 暂不提供 supply、withdraw、APY、更多 vault 或通用 ERC-4626。

因此不应重写 Morpho Adapter。未来可能的协作范围是：在 maintainer 认可后，为 #49 之后的 ERC-4626 抽象提供共通 Query、Receipt 测试或共享能力。

### Euler #10

Euler v2 的 vault 也是 ERC-4626，但借款涉及 EVC 和 sub-account。它需要先决定市场范围与 EVC 暴露面，属于高级协议 Adapter，不适合用来验证第一版通用 ERC-4626 抽象。

### Pendle #11

Pendle 更像收益交易：PT / YT / LP 的语义和分类需要设计讨论。它可以使用部分 Token / 资产流基础能力，但不是 ERC-4626 最直接的验证对象。

## 6. 建议的最小贡献策略

### 第 0 步：先做公开范围确认，不写代码

在 Issue #13 留言，说明我已核对：

- #13 依赖的 ADR 0009 已被当前框架替代；
- #31 后的架构使用自描述 Protocol 与显式依赖注入；
- Morpho #49 正在先做单 vault 的 query-only 实现；
- 我希望贡献一个不冲突的 ERC-4626 最小切片。

并请 maintainer 选择或确认优先级：

1. 先提交编译来源明确的 `IERC4626.sol → ERC4626Abi`；
2. 先设计地址无关的 ERC-4626 Query / Receipt 工具；
3. 先实现与 Morpho #49 可组合的受限 vault 查询；
4. 先更新 / 替换 #13 中已失效的架构说明。

### 第 1 步：得到范围确认后再创建 PR

优先选一个可以独立验收的小切片。候选顺序：

1. **文档 / Issue 设计澄清**：最低风险，能解决旧 ADR 引用问题；
2. **完整 ABI provenance + 编译生成链**：范围明确，但要遵循 ADR 0007；
3. **只读 ERC-4626 查询层**：例如 `asset`、`convertToAssets`、`previewDeposit`；
4. **一个 `supply` Capability**：包含嵌套 approve、Deposit Receipt、零 Warning E2E；
5. **withdraw / redeem**：作为后续独立 PR。

不建议第一步同时做通用实例化、多个 vault、完整存取款、APY、Morpho 集成和 Euler 集成。

## 7. Moss CONTRIBUTING.md 对本次工作的约束

任何正式 PR 前，需要做到：

- 从 `main` 新建分支；
- 阅读 `AGENTS.md`、`CONTEXT.md` 和相关当前 ADR；
- 用户可见 package 变更添加 changeset；
- 保持文档、示例、测试和源码同步；
- 通过 lint、build、typecheck、全量测试和 Monad Mainnet E2E；
- 顶层导出自描述 `@Protocol` class；
- 显式声明并注入依赖；
- 每个 Capability 一笔直接交易、一个 typed Receipt；
- Receipt 保持 Change 的完整、精确、有序覆盖；
- ABI 与固定地址都可追溯并可验证；
- 仅改动对应 package 和明确的 application composition root。

## 8. 准备向 Issue #13 询问的讨论草稿

以下是准备给 maintainer 的英文留言草稿，尚未发布：

```md
Hi! I would like to contribute to #13 and would like to confirm the smallest useful scope before opening a branch.

Could you confirm which next slice is preferred under the current architecture?

1. ABI provenance and generated `ERC4626Abi` in `@themoss/erc` only;
2. an address-free ERC-4626 Protocol with read-only conversion / preview Queries;
3. a curated, bound ERC-4626 vault composition pattern that can be reused by Morpho and Euler packages; or
4. first update the issue / architecture decision so the intended composition model is explicit.

I would like to take one clearly bounded slice, keep its rules in the appropriate ERC or Protocol package, and avoid overlapping the existing Morpho work in #49. Once the scope is confirmed, I can propose a narrow design and verification plan following CONTRIBUTING.md.
```

## 9. 当前结论

ERC-4626 #13 依然是高价值方向，但最正确的下一步不是直接 fork 编码，而是先把它从旧架构描述迁移到当前框架语境，并得到 maintainer 对最小切片的确认。

这样可以避免重复 Morpho #49 的工作，也避免为已被 PR #31 删除的 manifest / effects / reconciliation 模型新增兼容代码。
