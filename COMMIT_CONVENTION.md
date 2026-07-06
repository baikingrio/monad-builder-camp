# Git Commit 规范

本仓库用于 Monad Builder Camp 学习记录与 Proof of Work，commit message 应让人（和未来的自己）快速看懂**改了什么、属于哪类产出**。

## 格式

```text
<type>(<scope>): <subject>

[body]

[footer]
```

- **type**（必填）：变更类型
- **scope**（选填）：影响范围，通常是目录或子项目名
- **subject**（必填）：一句话摘要，中文，祈使语气，≤ 50 字，句末不加句号
- **body**（选填）：补充背景、链上地址、交易 hash、验证结果等
- **footer**（选填）：关联 issue、`BREAKING CHANGE` 等（本仓库较少用到）

## Type 定义

| Type | 用途 | 典型路径 |
|------|------|----------|
| `daily` | 每日学习笔记、残酷共学打卡 | `daily/` |
| `notes` | 主题笔记、课程整理、文档快照 | `notes/` |
| `exp` | 小实验、合约、链上交互、Foundry 项目 | `experiments/` |
| `project` | 正式项目原型与文档 | `projects/` |
| `portfolio` | 作品集、简历 bullet、展示材料 | `portfolio/` |
| `submission` | 提交材料草稿 | `submissions/` |
| `docs` | 仓库说明、README、规范文档 | 根目录、`*.md` |
| `chore` | 工具链、skills、配置、gitignore | `.agents/`、`.cursor/`、`skills-lock.json` |
| `fix` | 修复错误（合约 bug、文档纠错等） | 任意 |

## Scope 建议

scope 不是必填，但同一目录反复提交时建议带上，便于 `git log` 过滤：

| Scope | 含义 |
|-------|------|
| `monad-playground` | `experiments/monad-playground/` |
| `monad-skills` | `.agents/skills/`、`skills-lock.json` |
| `monad-docs` | `notes/monad/` |
| `camp` | 根目录全局配置、学习计划等 |

## 书写原则

1. **subject 写结果，不写过程**：「部署 CampToken 到 Testnet」✓，「今天学了一下 Foundry」✗（后者放 body 或 daily）
2. **链上相关放 body**：合约地址、tx hash、explorer 链接、验证状态
3. **一次 commit 一件事**：daily 笔记不要和合约代码混在同一 commit
4. **不提交秘密**：私钥、`.env`、API Key 永远不要出现在 message 里
5. **AI 辅助提交**：Agent 生成 message 后，人快速扫一眼再 commit

## 示例

### 实验 / 链上

```text
exp(monad-playground): 部署 CampToken 到 Monad Testnet

- 合约: 0xef694e5411A70d05270722A38Ea9Ef242E3afcf2
- 交易: 0x59d72a3596bc405f024b01a31a257a8ab2eed6dcb652473af924f312c53a5ff2
- Sourcify 验证: exact_match
```

```text
exp(monad-playground): 初始化 Foundry 项目 monad-playground
```

### 每日打卡

```text
daily: Week1 Day1 完成测试网钱包与首笔交易
```

### 笔记

```text
notes(monad-docs): 同步 llms-full 官方文档快照
```

### 文档 / 工具链

```text
docs: 补充领水与源码验证说明
```

```text
chore(monad-skills): 安装 monskills 并锁定版本
```

### 修复

```text
fix(monad-playground): 修正 CampToken transfer 余额检查
```

## 常用 git log 过滤

```shell
git log --oneline --grep "^exp"
git log --oneline -- experiments/monad-playground
git log --oneline -- daily/
```

## 与旧 commit 的关系

早期 commit 可能使用自由格式中文（如整句描述）。**新 commit 从本规范生效之日起遵循上述格式**，无需改写历史。
