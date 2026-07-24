# Session Key 免弹窗抽奖设计

**日期：** 2026-07-22  
**状态：** 已上链验证

## 前置证明

- Safe：`0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276`
- UserOp：`0x6575bac739c97acd2ffb1466fec690c67e260fa89d891bc3f14d2b43ddfff93e`
- Tx：`0xfd3e1a879728595da7ce01fac221b91a0f9c25beeb1481f32420faab7245fc11`

## 免弹窗抽奖证明

- Tx：`0x4d334a92634567482bd906afe4b2cccc325de152bd936ccb2641af9618dfb604`

## 方案

1. 用户明示点击「启用免弹窗抽奖」
2. 浏览器生成 ephemeral Session Key（secp256k1），仅存 localStorage
3. **一次** Owner 钱包弹窗：UserOp 调用 Safe `addOwnerWithThreshold(sessionKey, 1)`，Gas 由 EntryPoint Deposit 支付（无 Paymaster）
4. 服务端记录 grant：`eoa/safe/sessionAddress/expiresAt`（无固定次数上限；Gas 由 Deposit 约束）
5. 后续「免弹窗抽奖」：本地 Session Key 签 UserOp → 服务端校验仅 `LuckyDraw.draw()` / value0 / 未过期 → Bundler 提交（同样由 Deposit 支付）

## 安全边界

- 浏览器不存 Paymaster / API Key
- 应用层 + 服务端强制：固定 LuckyDraw、`draw()`、`value=0`、过期；次数上限已移除，改由 EntryPoint Deposit 余额约束
- 链上：Session Key 成为 Safe owner（threshold=1）后密码学上可执行任意操作；Demo 依赖短有效期、Deposit 门闩、服务端拒签非 draw UserOp，并在 UI 明示风险
- 不做无限期、任意 calldata、主网

## 明确不做

- ERC-7579 / Zodiac Roles 完整链上策略模块（本期无独立部署）
- 自建 Faucet
