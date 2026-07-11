# Sponsor 授权端点：安全边界设计

## 目标与阶段边界

本文件定义学习项目中 Sponsor 授权端点的最小安全边界。端点只为 ERC-4337 UserOperation 签发 **Paymaster Sponsor 授权**；它不是通用交易签名服务，也不是资金保管或转发服务。

本阶段严格限定为 Monad Testnet（Chain ID `10143`）和测试资产。**端点只签发授权，不调用 `EntryPoint.handleOps`，也不提供公开 Relay / Bundler 入口。** UserOperation 的实际提交、打包和广播不在本端点职责范围内。

链上 `CampaignSponsoredPaymaster` 的 `authorizationDigest` 使用：

```solidity
keccak256(
  abi.encode(
    sender,
    nonce,
    keccak256(initCode),
    keccak256(callData),
    accountGasLimits,
    preVerificationGas,
    gasFees,
    validUntil,
    verificationGasLimit,
    postOpGasLimit,
    block.chainid,
    address(this)
  )
)
```

Sponsor 服务必须生成与该格式逐字节一致的原始 digest（不是 EIP-191 前缀消息），并由部署时固定的 `sponsorSigner` 签名。

该 Sponsor 授权与用户的账户 / UserOperation 签名是两项独立验证：用户账户签名由账户及 EntryPoint 按其实现验证，用于证明用户授权该 UserOperation；Sponsor 签名只证明固定的 `sponsorSigner` 同意为上述 digest 所绑定的内容提供 Paymaster 授权。Sponsor 签名不能代替用户账户签名，也不能让 Sponsor 授权覆盖或修复用户账户签名的安全语义。

## 当前 Sponsor 授权实际绑定的字段

每次授权必须基于服务器重新校验后的请求值。按当前合约的 `authorizationDigest`，Sponsor 签名实际绑定以下字段：

- **智能账户 sender**：目标 Smart Account 地址。授权不能被其他账户复用。
- **EntryPoint nonce**：该账户在目标 EntryPoint 的 nonce。授权仅对应这一 nonce，不能挪用到另一笔顺序操作。
- **`initCode` 哈希**：`keccak256(initCode)`。对于反事实账户部署，工厂、salt 或初始化参数被替换会改变授权。
- **`callData` 哈希**：`keccak256(callData)`。目标调用的全部字节均被绑定。
- **`accountGasLimits`**：PackedUserOperation 的完整 32-byte 账户 verification gas 与 call gas 编码。
- **`preVerificationGas`**：UserOperation 的预验证 gas。
- **`gasFees`**：PackedUserOperation 的完整 32-byte max priority fee 与 max fee 编码。
- **`validUntil`**：Unix 秒时间戳，编码为合约要求的 `uint48`。超过该时间不得签发或接受。
- **Paymaster `verificationGasLimit`**：`paymasterAndData` bytes `[20:36]` 的 16-byte 编码。
- **Paymaster `postOpGasLimit`**：`paymasterAndData` bytes `[36:52]` 的 16-byte 编码。
- **Chain ID**：固定为 `10143`。该字段同时进入 digest，防止跨链或跨环境重放。
- **Paymaster 地址**：目标 `CampaignSponsoredPaymaster` 合约地址。该字段进入 digest，避免授权迁移给其他 Paymaster。

返回的 `paymasterAndData` 必须遵循合约格式：Paymaster 地址（20 bytes）、verification gas（16 bytes）、post-operation gas（16 bytes）、`validUntil`（6 bytes）、Sponsor 签名（65 bytes）。服务端必须在返回前检查长度、各字段编码及地址前缀。

## 成本绑定与端点开放前提

`CampaignSponsoredPaymaster` 的 digest 已加密绑定完整的 sponsored cost：`accountGasLimits`、`preVerificationGas`、`gasFees`、paymaster verification gas limit 与 post-operation gas limit。调用方在 Sponsor 签名后替换其中任一字段，都会生成不同 digest 并使验证失败。端点侧必须使用请求中将被签名的精确 PackedUserOperation 字节，并按上面的参数顺序生成 digest。

字段绑定防止授权内容被替换，但不自动设定可承担成本的业务上限。端点仍应在签名之前对全部 gas 字段实施明确、保守的服务端上限和费用策略；这既限制单次授权的最大暴露，也避免签发不合理的操作。

当前私有学习实现会在签名前拒绝超过以下任一上限的候选：账户 verification gas `300,000`、账户 call gas `500,000`、`preVerificationGas` `100,000`、max priority fee `3 gwei`、max fee `10 gwei`、Paymaster verification gas `300,000`、post-operation gas `100,000`。唯一允许的调用是配置的 `SessionKeyDemoTarget.checkIn(string)`：外层 `execute` 的 value 必须为零，内层 ABI 必须可规范解码为该函数，且 note 非空、UTF-8 不超过 280 bytes。

## 请求验证与最小授权范围

端点只接受完整、可解析的 UserOperation 候选数据，并在签名前执行以下限制：

1. **网络固定**：请求声明的 chain ID、服务端 RPC 所在网络以及配置的 Paymaster 都必须对应 Monad Testnet `10143`；不能依赖客户端声称的网络。
2. **账户与 nonce 校验**：`sender` 必须是合法地址；nonce 必须是合法非负整数，并应以目标 EntryPoint 当前规则读取/验证，而非只信任客户端输入。
3. **部署数据与调用数据校验**：`initCode` 和 `callData` 必须是格式正确的十六进制字节；服务端对收到的原始字节计算哈希，绝不接受客户端提交的“预计算哈希”代替原文。
4. **目标与函数白名单**：服务端必须解析 `callData` 所表达的账户执行调用，只允许预先配置的目标合约地址和函数 selector 组合。未列入白名单的目标、selector、批处理子调用或无法可靠解析的编码，一律拒绝。白名单应面向具体实验操作，而非“任意合约”或“任意 selector”。
5. **短时有效**：`validUntil` 由服务端生成，使用短 TTL（例如数分钟），不得让客户端任意指定延长时间；服务器时钟到期前后均应保守处理。
6. **最小化配置与密钥**：只使用服务端私有 Sponsor 签名密钥；密钥未配置时立即失败，不能降级为浏览器签名、测试密钥或无签名授权。

本阶段的 `/api/sponsor` 是默认关闭的私有本地/开发学习路由；`NUXT_SPONSOR_SIGNING_ENABLED=true` 才可使用。它不得公开暴露。持久认证、分布式限流、用户/项目配额、预算计量、熔断器，以及 RPC nonce 校验和持久审计日志，都是未来公开部署的前置要求，**今天并未实现**；不得以进程内内存计数器冒充生产防护。

未来公开部署时，服务端应将授权请求、拒绝原因、授权 digest、`sender`、nonce、目标/selector 和到期时间写入不含私钥的持久审计日志；日志不得记录 Sponsor 私钥或其他秘密环境变量。

## 明确拒绝条件

以下情况必须拒绝，且不得产生部分授权或替代性签名：

- 缺少必要字段，或地址、nonce、hex 字节、Paymaster 数据等格式不合法；客户端提供的 `validUntil` 不参与签名；
- chain ID 不是 `10143`，RPC/部署配置与 Monad Testnet 不一致，或 Paymaster 地址不匹配；
- 服务端生成的 `validUntil` 无法安全表示或已经到期；
- 从 `callData` 解析出的目标地址或函数 selector 不在精确白名单内；对于嵌套/批量调用，任一子调用不在白名单内，或解析存在歧义；
- 服务端 Sponsor 私钥、对应签名器配置或必要的 Paymaster 配置缺失；
- 服务端无法获得可信链上状态，或请求字段无法与将被签名的 UserOperation 精确对应。

对外响应可以使用稳定的错误码（如 `MALFORMED_REQUEST`、`WRONG_CHAIN`、`EXPIRED`、`CALL_NOT_ALLOWED`、`SPONSOR_KEY_UNAVAILABLE`），但不应泄露私钥、内部 RPC、完整白名单配置或其他敏感诊断信息。

## 私钥与浏览器边界

Sponsor 私钥**绝不能**发送到浏览器、打包进前端 JavaScript、置于 `NUXT_PUBLIC_` 环境变量、浏览器存储或任何客户端日志中。浏览器代码和用户设备均不可信：XSS、恶意扩展、依赖投毒、浏览器调试工具或设备被接管都可提取客户端可读的密钥。一旦泄露，该密钥可无限制地为攻击者构造的操作签名，并消耗 Paymaster 存款。

私钥只能由服务端私有环境变量或受控密钥管理服务读取；访问端点本身不等同于获得任意签名能力，因为端点仍须执行本文件的字段绑定、链限制、白名单与短 TTL 检查。

## 抗内容替换与重放说明

截获一份授权不允许攻击者把它改用于另一笔已签名绑定内容。签名 digest 同时包含 `sender`、nonce、`keccak256(initCode)`、`keccak256(callData)`、完整的账户与 Paymaster gas 字段、`validUntil`、chain ID 与 Paymaster 地址。因此，替换接收账户、nonce、部署参数、调用目标、selector、参数、任一已列 gas 字段、网络、Paymaster 或到期时间中的任一项，都会生成不同 digest；链上 Paymaster 恢复得到的签名人将不再是固定的 `sponsorSigner`，验证会失败。

这不代表授权完全不可重放：在相同的已绑定字段且尚未到期时，授权可被再次提交。EntryPoint 接受并消费该 nonce 后，会阻止同一 nonce 被再次使用；这不应表述为只有内层调用成功才消费 nonce。根据失败发生在验证、执行或后续处理的具体位置，一项操作即使其内层执行失败也可能已消费 nonce。短 TTL 进一步缩小操作尚未被消费时的可用窗口。由于本阶段不运营公开 Relay，服务端也不替外部请求者广播截获的授权。

## 非目标

本设计不授予以下能力：

- 为任意链、主网、真实资产或任意 Paymaster 签名；
- 为未白名单的合约调用、函数或批量交易签名；
- 代替用户账户签名、改变 UserOperation 的 gas/交易内容，或承诺交易一定被打包；
- 调用 `EntryPoint.handleOps`、运行公共 bundler，或暴露公开 relay API。
