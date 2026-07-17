# Moss 系列学习笔记｜Agent 可检查的链上操作

> 本目录作为我的 Moss 系列学习入口。后续对 Moss 的源码阅读、MCP 实践、Adapter 分析、开源贡献和安全边界，统一补充到这里或从这里链接出去。
>
> 当前上游阅读版本：`nishuzumi/moss` commit `1ef6f62`（2026-07-16）。Moss 仍是未经审计的 Alpha 软件；官方当前面向 Monad Mainnet（Chain ID `143`）。

## 学习索引

- [Moss 学习笔记、GitHub 探索与开源贡献计划](../week2/2026-07-13-moss-open-source.md)
- [从 Moss 的未签名 Plan，到一个可检查的安全审核器](../week2/2026-07-16-moss-plan-reviewer-practice.md)
- [02｜ERC-4626 Adapter 贡献调研与设计草案](./02-erc4626-adapter-contribution.md)
- [Moss Plan Reviewer 原型](../../experiments/moss-plan-reviewer/README.md)
- [MCP / RPC 与 Testnet Proof](../../experiments/moss-plan-reviewer/docs/moss-mcp-rpc-evidence.md)

---

# 01｜Moss 是什么：为什么 Agent 需要它

## 一句话理解

**Moss 是一个把 Monad 上的协议交互整理为 Agent 可调用 Capability 的框架。**

它不是钱包，不保存私钥，也不替用户签名或广播交易。它的角色是：在签名之前，帮助 Agent 和用户把“想做什么”“将构造什么交易”“模拟后实际发生了什么”逐项对齐。

官方流程是：

```text
discover → load → action → simulate → 人工核对 → 钱包确认
```

例如用户说“用 1 MON 换 USDC”，直接让 Agent 拼 Router 地址、ABI、calldata、授权和滑点，容易出错，也很难说明交易是否符合原始意图。Moss 希望把这类复杂性收进协议方可维护、可测试的标准能力中。

## Moss 解决的实际问题

没有 Moss 时，一个 Agent 需要自行判断或拼装：

- 使用哪个协议、哪个合约地址；
- ABI 是否正确；
- 函数参数、Token 精度与 calldata；
- 是否需要 `approve`；
- 交易实际转出了什么、收到了什么；
- 是否有额外授权、额外资产流或异常事件。

Moss 不承诺“Agent 一定能赚钱”或“交易一定成功”。它提供的是一条更可检查的路径：

1. 先发现能力；
2. 读取该能力的参数、单位、风险和限制；
3. 构建未签名 Capability Tree；
4. 在真实 Monad 链上状态下模拟；
5. 将模拟的资产变化解释为人能阅读的 Receipt；
6. 由用户或上层 Agent 对照最初意图后，才可能交给钱包签名。

## 对 Web3 新人的比喻

可以把 Moss 看作“链上操作的标准化旅行平台”。

- 用户说：“我要从 A 到 B。”
- Agent 像旅行助理，理解需求、解释路线。
- Adapter / Protocol package 像航空公司或铁路公司的标准接口，说明有哪些服务、需要哪些信息、有哪些风险、如何核验行程结果。
- Simulator 像出发前的完整演练。
- 钱包仍是用户本人，最后由用户决定是否付款和确认。

重点是：旅行助理不能绕过你直接刷卡；Moss 也不能绕过用户钱包动用资产。

---

# 02｜核心架构：六层如何协作

```text
用户 / Agent
  ↓  discover / load / action / simulate
MCP Server
  ↓
Registry + Core
  ↓
Protocol packages（常被称作 Adapter）
  ↓
Simulator
  ↓
Monad Mainnet RPC
```

| 层 | 做什么 | 不做什么 |
| --- | --- | --- |
| 用户 / Agent | 说明意图、阅读风险、决定是否继续 | 不应跳过核对直接假定交易安全 |
| MCP Server | 暴露四个标准工具 | 不签名、不发送交易 |
| Core / Registry | 注册协议、校验参数、构建 Capability Tree、检查 Receipt | 不替协议猜业务语义 |
| Protocol package | 定义 ABI、地址、操作、参数、风险、Receipt | 不持有用户私钥 |
| Simulator | 用 trace 模拟并提取 Change | 不把模拟当作未来交易保证 |
| Monad RPC | 提供真实链上状态和 trace 证据 | 不替用户表达交易意图 |

官方 MCP Server 只暴露四个工具：

1. `discover`：按 `swap`、`transfer`、`wrap` 等动词或类别发现 Capability / Query；
2. `load`：读取某个能力的 intent、风险标签、参数类型和字段含义；
3. `action`：Query 直接返回数据；写操作则生成未签名 Capability Tree；
4. `simulate`：基于真实链上状态执行计划、解析结果并返回 warnings 与有序 Receipt 文本。

---

# 03｜Adapter 架构：Moss 中的 Protocol package

## Adapter 到底是什么

Moss 源码中更常用的名称是 **Protocol package**。可以把它理解成某一协议的完整适配层：它不只是包一层合约调用，而是把协议的业务语义、安全约束、交易构建和结果解释一起交给 Moss。

一个 Protocol package 负责：

- ABI 和合约地址；
- Capability（可执行的业务操作）；
- Query（只读查询）；
- 依赖的其他 Protocol；
- 参数契约与风险标签；
- Receipt parser（解释模拟结果）；
- 来源、边界和测试。

目前官方 README 列出的能力包括 WMON 的 wrap / unwrap、ERC-20 与原生 MON 的 transfer / approve、ERC-721 transfer，以及 Kuru 的 quote / swap。

## 为什么不让 Agent 临时拼 ABI 和 calldata

一个可靠 Adapter 首先要能回答：

- 合约地址来自哪里？
- ABI 来自已验证源码、浏览器，还是可信上游 artifact？
- 链上 bytecode 是否与预期一致？
- 固定 Token 的名称、符号、精度是否验证过？

Moss 接入指南要求 ABI 有明确来源，不接受手工抄写 ABI 或只手选少数函数的方式。原因很简单：如果 ABI、地址或函数编码错了，即使交易“发出去了”，也可能根本不是用户想做的操作。

## `@Protocol`：协议的自我描述

Adapter 会用类似下面的元数据描述自己：

```ts
@Protocol({
  name: "kuru",
  category: "dex",
  description: "Kuru 的链上订单簿兑换能力",
  contracts: {
    router: { abi: KuruRouterAbi, addr: KURU_ROUTER_ADDRESS },
  },
  protocols: { erc20: ERC20 },
})
```

这表达的是：

> “我是 Kuru DEX 的适配层。我知道 Router 的 ABI 和地址；我依赖通用 ERC-20 协议能力来处理授权；我向 Agent 暴露的能力属于 DEX 类别。”

依赖显式声明很关键。Kuru 需要 ERC-20 授权时，会调用 ERC Adapter 生成嵌套 Capability，而不是在 Kuru 代码里偷偷塞入一笔无法解释的授权交易。

---

# 04｜Capability：把“合约函数”变成“用户意图”

Capability 是 Agent 可以理解和调用的业务操作，例如：

```text
swap / wrap / unwrap / transfer / approve / supply / stake / claim
```

以 Kuru 的 `swap` 为例，它描述的不只是某个 Solidity 函数，还包括：

- `intent`：通过当前最优 Kuru 市场路径兑换 Token；
- `verb`：`swap`；
- `params`：输入 Token、输出 Token、数量、滑点；
- `risk`：`fundOut`、`approval`、`priceImpact`；
- `receipt`：模拟后由哪个 Receipt parser 解释结果。

这让 Agent 在构造交易之前先知道：

> 这是一次兑换；资金会流出；可能需要授权；价格会受滑点影响；参数存在明确单位与限制。

## 参数契约：不能靠猜

Moss 的 `load` 会同时输出两类信息：

- **类型契约**：格式、单位、范围、换算与示例；
- **字段说明**：该参数在当前操作中控制什么。

例如滑点的类型会说明 `1 bps = 0.01%`；字段说明会指出它限制兑换执行前能接受的最大不利价格变化。这样 `50` 不会被模糊理解成 50%：它是 50 bps，即 0.5%。

因此正确流程不是看到 `swap` 就调用，而是必须先 `discover`，再 `load`。

---

# 05｜Capability Tree：多笔交易也必须可解释

一项用户操作可能包含多个链上步骤。例如用 ERC-20 兑换：

```text
Kuru.swap
├── ERC20.approve
│   └── 一笔授权交易
└── Kuru.swap
    └── 一笔兑换交易
```

Moss 的重要规则是：

> 每个 Capability 只拥有一笔直接交易；额外交易必须作为嵌套 Capability 出现。

这样做能让用户和 Agent 分清：

- 哪一笔是 `approve`；
- 哪一笔是实际 `swap`；
- 是否出现意外的额外调用；
- 模拟结果分别对应哪一层操作。

MCP 的 `action` 返回的 Tree 不应被 Agent 手动修改、重排或“修复”。参数有变化时，正确做法是重新调用 `action`。

---

# 06｜Receipt Parser：模拟后到底发生了什么

交易成功不代表交易符合意图。一次交易可能成功，但仍可能：

- 花出了不预期的资产；
- 授权给不预期的 spender；
- 把资产转给不预期的对象；
- 触发额外或异常事件。

Moss 的 Simulator 会从真实执行 trace 中记录不可变 `Change`，主要包括 Event 和原生 MON 转账。随后 Adapter 的 Receipt parser 负责将这些底层 Change 翻译成业务上可读的结果。

Kuru swap 的 Receipt 会检查并解释：

- ERC-20 资产流；
- Kuru 的 `Trade` 事件；
- Kuru Router 的 swap 事件；
- 必要时的原生 MON 转账。

最终可以输出类似：

```text
Kuru Swap：用多少 Token 换出多少 Token，
由谁发起，观察到几笔成交事件。
```

## 完整覆盖是 Moss 的安全重点

Receipt 不是只挑几个“看上去重要”的 Event。Moss Core 会验证 Receipt 是否对原始 Change 做到：

```text
完整覆盖 + 不重复 + 不替换 + 顺序一致
```

如果 Receipt 漏掉、重复、替换或重排了 Change，Moss 会给出 Warning 并停止。它宁可拒绝不完整证据，也不会假装已经理解执行结果。

---

# 07｜模拟与 Warning：什么情况下必须停止

`simulate` 使用 Monad 状态和 `debug_traceCall` 证据执行 Capability Tree。它会深度优先模拟嵌套操作，并让后续交易继承前一步的模拟状态。

以下任一 Warning 都应停止，不应把交易交给签名方：

- `REVERTED`：交易回滚；
- `TRACE_FAILED`：RPC 无法提供 trace 证据；
- `CHANGE_ORDER_UNAVAILABLE`：无法证明 Event / 原生币转账的精确顺序；
- `RECEIPT_FAILED`：Protocol 无法正确解释 Change；
- `CHANGE_COVERAGE_MISMATCH`：Receipt 对 Change 的覆盖不完整或顺序不一致；
- `STATE_CHAIN_FAILED`：无法从前序模拟推导后续状态。

即使 `warningCount = 0`，也只说明：

> 模拟中观察到的 Change 已被完整、有序地解释，且没有发现框架定义的 Warning。

它**不**证明未来上链一定成功，也不等于用户的真实意图一定已满足。用户仍要逐项检查资产、金额、接收方、授权对象、协议选择和限制条件。

---

# 08｜Kuru Adapter：从用户请求到模拟结果

假设用户说：

> “用 1 MON 换 USDC，最多接受 0.5% 滑点。”

对应的正确流程：

1. `discover({ verb: "swap" })`：发现可用兑换能力；
2. `load({ protocol: "kuru", method: "swap" })`：读取参数、风险与单位；
3. `action(...)`：生成未签名 Capability Tree；
4. `simulate(tree)`：模拟、解析 Receipt、检查 warnings；
5. 逐项对照：输入资产、输入数量、最小输出、授权 spender、协议是否符合原意；
6. 只有用户认可，才把原样计划交给钱包签名。

Kuru Adapter 在内部会：

- 动态发现并验证市场路径；
- 查询报价；
- 根据 Token 精度转换用户输入数量；
- 计算最小可接受输出；
- 如果输入为 ERC-20，则生成对 Router 的嵌套 `approve` Capability；
- 构建 Router swap 交易；
- 模拟后验证 Router swap 事件、Trade 事件和资产流是否一致。

---

# 09｜Moss 的价值与边界

## 对用户

- 在签名前看见更具体的资产流、授权和接收方；
- 不必把私钥交给 Agent；
- 钱包仍拥有最后确认权。

## 对 Agent 开发者

- 不必为每个协议手写地址、ABI、calldata 和事件解析；
- 可通过统一 MCP 接口接入不同协议；
- 可把“先模拟、再核对”的安全步骤变成产品能力，而不只依赖 Prompt。

## 对协议方和贡献者

- 协议方能维护自己的 Agent 接口与业务语义；
- 贡献者可以把 Web3 知识变成可复用的公开能力；
- Adapter 的质量可通过 ABI 来源、测试和真实模拟证据检查。

## Moss 不是什么

Moss 不是：

- 钱包或私钥托管；
- 自动交易机器人；
- Relayer、Bundler 或 Paymaster；
- “模拟成功即保证交易成功”的工具；
- 让 AI 绕过用户确认的工具。

---

# 10｜如果未来自己开发一个 Adapter

以 Monad 上某个质押协议为例，工作不只是调用 `stake(amount)`，还需要：

1. 确认合约地址、ABI 来源与链上 bytecode；
2. 定义 Protocol 元数据、类别和依赖；
3. 设计用户能理解的 Capability；
4. 写清参数的单位、范围、默认值和业务意义；
5. 给出风险标签；
6. 构造可解释的 Capability Tree；
7. 为 Event 与资产流编写 Receipt parser；
8. 验证 Receipt 不漏、不重、不乱序；
9. 编写参数、失败路径、Receipt 覆盖和嵌套操作测试；
10. 用 Monad Mainnet 的真实状态留下零 Warning 模拟证据；
11. 写明支持范围、风险、限制和已验证地址来源。

因此，Adapter 不是简单“合约封装层”，而是：

> **协议语义 + 安全约束 + 交易构建 + 执行结果解释** 的完整适配层。

---

# 11｜我的实践与下一步

我已经完成了一个 [Moss Plan Reviewer](../../experiments/moss-plan-reviewer/README.md)。它位于 Adapter 的下游：不负责生成协议调用，而是检查模拟结果是否存在 warning、未声明支出、异常 approval 或异常接收方；即使没有异常，也要求用户最终确认。

已完成的公开验证包括：

- 通过官方 Moss MCP Server 完成 `discover → load → action → simulate`；
- Monad Mainnet 只读模拟生成未签名 Plan，`warningCount = 0`；
- 用独立 Monad Testnet `MossPlanHashProof` 合约记录固定 PlanHash 回执；
- 明确区分“主网只读模拟”与“Testnet 回执”，不把它说成 Moss 自动执行。

下一步阅读顺序：

1. 深读 [Protocol Onboarding](https://github.com/nishuzumi/moss/blob/main/docs/protocol-onboarding.md)；
2. 按函数拆解 [Kuru Adapter](https://github.com/nishuzumi/moss/blob/main/packages/protocols/kuru/src/kuru.ts)；
3. 阅读 [Protocol Template](https://github.com/nishuzumi/moss/blob/main/packages/protocols/_template/src/adapter.ts)；
4. 尝试设计一个只包含 `Query + 一个 Capability + 一个 Receipt` 的学习型 Adapter 方案，先不急于提交上游 PR。

## 官方参考

- [Moss README](https://github.com/nishuzumi/moss)
- [MCP Tools Reference](https://github.com/nishuzumi/moss/blob/main/docs/mcp-tools.md)
- [Protocol Onboarding](https://github.com/nishuzumi/moss/blob/main/docs/protocol-onboarding.md)
- [Agent Safety Rules](https://github.com/nishuzumi/moss/blob/main/docs/agent-skill.md)
- [Kuru Adapter](https://github.com/nishuzumi/moss/blob/main/packages/protocols/kuru/src/kuru.ts)
