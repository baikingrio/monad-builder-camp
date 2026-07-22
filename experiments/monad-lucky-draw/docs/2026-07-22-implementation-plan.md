# Monad Lucky Draw 独立 Demo 实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**目标：** 在 Monad Testnet 建立一个独立的抽卡 Demo：用户用自己的 EOA 完成首次明确授权，获得可预测的 AA Safe 地址，首次抽卡由项目方受限赞助；在完成安全验证后，后续抽卡可使用仅限抽卡的 Session Key，避免反复弹出钱包。

**架构：** 采用独立 Nuxt 4 + Nitro + Viem 前端/服务端项目与独立 Foundry 合约目录。浏览器只保存用户 EOA、短期登录状态和受限 Session Key；Paymaster、运营 Faucet、预算、反滥用与赞助判断均只能在服务端。抽卡合约只记录结果并发出事件，不处理真实资产、NFT 交易或任意执行。

**技术栈：** Nuxt 4、Vue 3、TypeScript、Viem、Vitest、Nitro、Foundry、Solidity、Monad Testnet（Chain ID 10143）、ERC-4337 / Safe、Pimlico（仅服务端受控的 Bundler / Paymaster）。

---

## 产品范围和不可突破的边界

### 本期用户路径

1. 用户连接自己的 EOA；
2. 用户签署带 nonce、域名、过期时间的登录 / 绑定消息；
3. 页面推导并展示该 EOA 对应的 counterfactual Safe 地址；
4. 用户主动点击“激活并免费抽一次”；
5. 服务端仅在资格有效时签发一次指定抽卡调用的赞助；
6. 首次 UserOperation 部署 Safe（若未部署）并调用 `draw()`；
7. 页面展示抽卡结果、Safe 地址、UserOperation / 交易状态与 MonadVision 链接；
8. 只有完成 Session Key 模块兼容性和权限验证后，才开放“免钱包弹窗再抽一次”。

### 明确不做

- 主网、真实资产、真实 NFT 交易、兑换或提现；
- 浏览器保存 Sponsor 私钥、Paymaster API Key、运营钱包私钥或管理员凭证；
- 任意 calldata、任意合约调用、无限 Sponsor 或无限期 Session Key；
- 仅凭登录签名就将操作描述为链上授权；
- 未获得公开 hash / receipt 时宣称已发送或已赞助 UserOperation；
- 将 Monad Passkeys 试验路径描述为 Safe 官方支持的 Monad Passkeys 产品能力。

### 关键安全策略

- 赞助仅支持：`chainId = 10143`、固定 `LuckyDraw` 合约、固定 `draw()` selector、`value = 0`、固定 gas 上限、短有效期；
- `EOA + Safe` 对只可使用一次首次赞助；服务端存储使用记录，并启用 IP / 地址限频、总预算、熔断器；
- Session Key 权限必须同时限制目标合约、函数 selector、`value = 0`、调用次数、过期时间；
- 登录 nonce 只能使用一次；服务端 session 使用 HttpOnly / Secure Cookie，生产环境不得采用内存存储；
- Demo Faucet 与 Sponsor 分开建模。Faucet 必须有单独的额度、资格、审计与关闭开关；在其完成前，页面只提供官方 Monad Testnet Faucet 链接。

## 目录结构

```text
experiments/monad-lucky-draw/
├── README.md
├── .env.example
├── package.json
├── nuxt.config.ts
├── app/
│   ├── pages/index.vue                 # 抽卡主流程
│   ├── components/                     # 连接、Safe 状态、抽卡结果、权限提示
│   └── lib/
│       ├── chain.ts                    # Monad 固定网络/Explorer 配置
│       ├── drawPolicy.ts               # 纯函数：Sponsor / Session Key 权限判断
│       ├── authMessage.ts              # 纯函数：nonce 登录消息
│       ├── safeAddress.ts              # 纯函数：counterfactual 地址输入校验
│       └── demoState.ts                # 可测试的 UI 状态机
├── server/
│   ├── api/auth/nonce.get.ts
│   ├── api/auth/verify.post.ts
│   ├── api/draw/readiness.get.ts
│   ├── api/draw/sponsor-authorization.post.ts
│   ├── api/faucet/status.get.ts
│   └── utils/
│       ├── auth.ts                     # nonce/session 验证
│       ├── sponsorPolicy.ts            # 强制白名单和一次性资格
│       ├── rateLimit.ts                # 地址/IP 限流接口
│       ├── store.ts                    # 开发内存实现；生产替换 SQLite
│       └── runtime.ts                  # 仅服务端的私有配置
├── contracts/
│   ├── foundry.toml
│   ├── src/MonadLuckyDraw.sol
│   ├── test/MonadLuckyDraw.t.sol
│   └── script/DeployMonadLuckyDraw.s.sol
├── tests/
│   ├── drawPolicy.test.ts
│   ├── authMessage.test.ts
│   ├── demoState.test.ts
│   ├── sponsorPolicy.test.ts
│   └── index-page.test.ts
└── docs/
    └── 2026-07-22-implementation-plan.md
```

## 分阶段实施任务

### Task 1：初始化独立 Nuxt / Foundry 实验结构

**目标：** 将抽卡 Demo 与既有 `erc4337-frontend` 完全隔离，且不复制任何私钥或现有 Sponsor 配置。

**文件：**
- Create: `experiments/monad-lucky-draw/package.json`
- Create: `experiments/monad-lucky-draw/nuxt.config.ts`
- Create: `experiments/monad-lucky-draw/.env.example`
- Create: `experiments/monad-lucky-draw/contracts/foundry.toml`
- Create: `experiments/monad-lucky-draw/README.md`

**步骤：**
1. 写 README 和 `.env.example`；仅放占位变量，不填真实值。
2. 初始化 `npm test`、`npm run build`、`forge test` 命令。
3. 在 README 写明项目当前仍是脚手架，绝不将未实现功能称为可赞助/免签执行。
4. 运行 `git diff --check`。
5. Commit: `chore(lucky-draw): 初始化独立实验结构`。

### Task 2：实现并测试最小抽卡合约

**目标：** 在 Monad Testnet 可部署、可验证地记录抽卡事件，且不接受原生币或任意 calldata。

**文件：**
- Create: `contracts/src/MonadLuckyDraw.sol`
- Create: `contracts/test/MonadLuckyDraw.t.sol`
- Create: `contracts/script/DeployMonadLuckyDraw.s.sol`

**Step 1：先写失败的 Foundry 测试**

测试至少覆盖：

```solidity
function testDrawEmitsCardDrawnAndIncrementsUserCount() public;
function testDrawRejectsNativeValue() public;
function testDrawUsesBoundedPseudoRandomnessForDemoOnly() public;
```

抽卡结果只能使用明确标注为 Demo 的确定性 / 可复现伪随机逻辑；不能假装为可抗操纵的生产随机数。

**Step 2：确认 RED**

Run: `forge test --match-path test/MonadLuckyDraw.t.sol -vv`

Expected: FAIL，因为合约或 `draw()` 尚不存在。

**Step 3：最小实现**

- `draw()` 必须 `payable` 为 false；
- 仅按调用者、nonce 和 `block.prevrandao` 生成 demo rarity；
- 发出 `CardDrawn(address indexed player, uint256 indexed drawNumber, uint8 rarity)`；
- 记录 `drawCount[player]`；
- 不铸造可交易资产、不接收 MON。

**Step 4：确认 GREEN**

Run: `forge test --match-path test/MonadLuckyDraw.t.sol -vv`

Expected: PASS。

**Step 5：部署前验证**

- `forge build`；
- 先以课程测试账户执行不广播的 `forge script ...` 模拟；
- 广播前必须获得用户明确批准；广播后记录合约地址、receipt 与 MonadVision 链接。

### Task 3：建立可测试的登录、AA 地址与 UI 状态核心

**目标：** 清晰区分 EOA 登录签名、counterfactual Safe 地址和链上激活状态。

**文件：**
- Create: `app/lib/authMessage.ts`
- Create: `app/lib/safeAddress.ts`
- Create: `app/lib/demoState.ts`
- Create: `tests/authMessage.test.ts`
- Create: `tests/demoState.test.ts`

**Step 1：先写失败测试**

```ts
it('binds login message to EOA, nonce, origin and expiry')
it('does not treat a login signature as Safe execution authorization')
it('shows generated-but-not-deployed Safe separately from active Safe')
it('does not expose draw action before wallet, login and chain readiness')
```

**Step 2：确认 RED**

Run: `npm test -- --run tests/authMessage.test.ts tests/demoState.test.ts`

**Step 3：最小实现**

- 签名文本 / typed data 包含 EOA、nonce、origin、issuedAt、expiresAt；
- `DemoState` 至少包含 `disconnected`、`walletConnected`、`authenticated`、`safeDerived`、`activationReady`、`activationPending`、`active`、`failed`；
- Safe 地址仅接受经校验的 Owner / factory / salt 输入；具体 Safe SDK 推导接入在后续任务完成。

**Step 4：确认 GREEN**

Run: `npm test -- --run tests/authMessage.test.ts tests/demoState.test.ts`

### Task 4：实现前端可演示的连接、身份与抽卡结果 UI

**目标：** 即使 Sponsor 尚未配置，页面也应诚实展示下一步，而不崩溃或伪造成功。

**文件：**
- Create: `app/pages/index.vue`
- Create: `app/components/WalletConnectionPanel.vue`
- Create: `app/components/SafeStatusCard.vue`
- Create: `app/components/DrawResultCard.vue`
- Create: `tests/index-page.test.ts`

**Step 1：先写失败页面测试**

```ts
it('labels the derived Safe as not deployed before activation')
it('shows sponsored first draw as unavailable when readiness is false')
it('does not claim a UserOperation hash before one exists')
it('labels subsequent no-popup draws as unavailable until session-key authorization exists')
```

**Step 2：确认 RED**

Run: `npm test -- --run tests/index-page.test.ts`

**Step 3：最小实现**

- 仅在用户点击时连接钱包或请求签名；
- 显示 Monad Testnet 网络状态；
- 将 Sponsor / Session Key 未配置表示为不可执行的明确状态；
- 显示 Explorer 链接的条件是确有公开 hash / 地址；
- 先使用 API readiness 和页面状态，不加入客户端 Sponsor 凭证。

**Step 4：确认 GREEN**

Run: `npm test -- --run tests/index-page.test.ts`

### Task 5：建立服务端 Sponsor 资格和授权边界

**目标：** 只为一次合法的首次抽卡签发最小赞助授权，且未配置时默认拒绝。

**文件：**
- Create: `server/utils/sponsorPolicy.ts`
- Create: `server/utils/store.ts`
- Create: `server/utils/runtime.ts`
- Create: `server/api/draw/readiness.get.ts`
- Create: `server/api/draw/sponsor-authorization.post.ts`
- Create: `tests/sponsorPolicy.test.ts`

**Step 1：先写失败测试**

```ts
it('rejects a request with a different chain, contract, selector or nonzero value')
it('rejects a second sponsor request for the same EOA or Safe')
it('rejects unauthenticated, expired or replayed login sessions')
it('returns disabled when signing, budget or Paymaster config is absent')
it('never includes a private key or Paymaster credential in responses')
```

**Step 2：确认 RED**

Run: `npm test -- --run tests/sponsorPolicy.test.ts`

**Step 3：最小实现**

- 默认 `enabled = false`；
- 仅服务端读取 `LUCKY_DRAW_SPONSOR_*` 私有变量；
- 请求必须带已验证的 session；
- policy 必须绑定链、目标、selector、value、maxGas、expiry、EOA、Safe 和一次性 claim id；
- 开发期使用内存 store，但 API 返回 `persistence = development-only`；生产接入 SQLite 前不得公开部署 Sponsor API；
- 实现 IP 与 EOA 级限流接口、预算计数、全局熔断器。

**Step 4：确认 GREEN**

Run: `npm test -- --run tests/sponsorPolicy.test.ts`

**Step 5：真实执行门槛**

不满足持久化存储、限流、预算计数、审计记录和熔断器时，禁止启用真实 Sponsor 签发。

### Task 6：接入真实首次 AA UserOperation

**目标：** 将“激活并免费抽一次”接到真实 Monad Testnet UserOperation，但只在所有前置配置、模拟和用户确认完成后执行。

**文件：**
- Modify: `app/lib/safeAddress.ts`
- Create: `app/lib/activationUserOperation.ts`
- Modify: `app/pages/index.vue`
- Create: `tests/activationUserOperation.test.ts`
- Modify: `README.md`

**Step 1：先写失败测试**

测试必须证明：

- 只有 Safe 相关版本、Factory、EntryPoint 和 Module 兼容时才能构建；
- 激活操作仅包含 Safe 部署（若需要）和固定 `draw()` 调用；
- 用户拒绝 EOA 签名、模拟失败、Sponsor API 拒绝均不会被伪装成成功；
- UserOperation hash / MonadVision 链接只在实际获得后显示。

**Step 2：确认 RED**

Run: `npm test -- --run tests/activationUserOperation.test.ts`

**Step 3：最小实现与模拟**

- 使用固定的 Monad Testnet 配置；
- 在提交前完成 Bundler simulation；
- 明确请求一次 Owner 签名；
- 提交后持续读取状态，只有 receipt 成功才标记“首次抽卡完成”；
- 显示公开 UserOp hash、交易 hash、Safe 地址和 `CardDrawn` event。

**Step 4：测试网验证**

- `npm test`；`npm run build`；
- 先模拟，后由用户明确选择广播；
- 记录 public proof，且将失败结果如实记录。

### Task 7：Session Key 无钱包弹窗抽卡（仅在安全门槛通过后）

**目标：** 让后续抽卡无需浏览器钱包弹窗，但权限只能覆盖一次 / 有效期内的固定 `draw()`。

**前置 Gate：** 不先确认 Safe 模块、EntryPoint 版本、Session Key 验证路径和 Monad Testnet 实测兼容性，不得开始接入或宣传本能力。

**文件：**
- Create: `app/lib/sessionKeyPolicy.ts`
- Create: `app/lib/sessionKeyStorage.ts`
- Create: `server/utils/sessionKeyPolicy.ts`
- Create: `tests/sessionKeyPolicy.test.ts`
- Modify: `app/pages/index.vue`
- Modify: `README.md`

**Step 1：先写失败测试**

```ts
it('allows only the LuckyDraw draw selector with value zero')
it('rejects other target contracts and arbitrary calldata')
it('rejects expired, exhausted or revoked session keys')
it('does not mark session-key draw as available before onchain authorization')
it('does not store sponsor credentials or server secrets in the browser')
```

**Step 2：确认 RED / GREEN**

Run: `npm test -- --run tests/sessionKeyPolicy.test.ts`

**Step 3：实现与验证**

- 初始 Session Key 仅在用户明示“启用免签抽卡”后创建；
- 用户第一次授权操作必须可解释、可撤销，并显示范围与到期时间；
- 浏览器仅存用户 Session Key；它不应具备转账或任意执行权限；
- 后续 UserOperation 仍需服务端 policy 审核与 Bundler simulation；
- 测试网至少完成一次真实 receipt 后才能在页面标记“可免钱包弹窗抽卡”。

### Task 8：可选 Demo Faucet 与最终演示证据

**目标：** 使“领取测试 MON”成为明确、受限、可停止的独立能力，而不影响抽卡主链路。

**文件：**
- Create: `server/api/faucet/claim.post.ts`（仅在 Gate 通过后）
- Create: `tests/faucetPolicy.test.ts`
- Modify: `README.md`
- Create: `docs/demo-proof.md`

**Gate：** 运营钱包隔离、单次额度、余额下限、地址/IP 限流、审计记录、总预算和熔断器均完成；否则只展示官方 Faucet 链接。

**最终 Evidence：**

- 60–90 秒录屏：EOA 连接 → Safe 地址 → 首次授权 → 抽卡结果 → MonadVision；
- 公开合约地址、部署交易、至少一条真实 `CardDrawn` event；
- 自动化测试与生产构建输出；
- 明确标注实际已跑通 / 模拟 / 未完成项目；
- 3–5 位用户测试反馈和至少一次可追溯改进。

## 最终验收标准

- [ ] 抽卡合约已在 Monad Testnet 部署，且 `CardDrawn` 可在浏览器验证；
- [ ] EOA 登录签名与链上 AA Owner 授权在 UI / 文档中明确区分；
- [ ] Safe 地址的“已推导 / 已部署”状态准确；
- [ ] Sponsor 默认关闭，且只允许一次、受限 `draw()`；
- [ ] 未配置 Sponsor 时 Demo 不崩溃、不伪造成功；
- [ ] Session Key 仅在可验证的链上授权后开放，并受 target / selector / value / expiry / calls 限制；
- [ ] 全部 Nuxt / Foundry 测试和生产构建通过；
- [ ] 所有真实执行均有公开 hash / receipt；没有则如实标为未完成。
