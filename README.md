# Web3 暑期实习计划 - Monad Builder Camp 学习空间

> 训练营时间：2026/7/6 – 2026/8/7  
> 官方页面：https://web3career.build/zh/programs/Web3-Summer-Intership-Progra?tab=overview

这是 Quinn / baikingrio 参加 **Web3 暑期实习计划 - Monad Builder Camp** 的独立学习空间，用来记录接下来 1 个多月的学习、实验、项目构建和作品集材料。

## 训练营目标

用 AI 工具辅助开发、研究和创作，在 Monad 生态中完成一个可展示的链上产品，并沉淀为：

- 可运行 Demo / Repo
- 合约地址、Transaction Hash、Explorer 链接
- Pitch Deck
- 2–5 分钟 Demo Video
- Final Presentation
- Portfolio / 简历素材 / Proof of Work

## 推荐学习主线

Quinn 当前更适合以 **Tech Track 为主，Research / Product 为辅**：

- Tech：用 AI Coding 工具完成 Monad 链上产品原型、前端、智能合约或链上交互功能。
- Research：围绕 Monad 生态、用户需求、应用案例形成分析材料。
- Product：把项目打磨成可以展示、传播和写进作品集的完整故事。

## 目录结构

```text
README.md                 # 学习空间说明
profile.md                # 学习者背景与目标
learning-plan.md          # 训练营学习计划
.agents/skills/           # Monad Agent Skills（monskills）
skills-lock.json          # Skills 安装锁定文件
daily/                    # 每日学习笔记与残酷共学打卡
notes/                    # 主题笔记 / 课程整理
notes/monad/              # Monad 官方 llms-full 文档快照
experiments/              # 小实验、链上交互、代码验证
projects/                 # Monad 项目原型与项目文档
submissions/              # 提交材料草稿与记录
portfolio/                # 作品集、简历 bullet、展示材料
templates/                # 笔记模板
COMMIT_CONVENTION.md      # Git commit 规范
```

## Git Commit 规范

提交信息格式见 [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md)。简要格式：

```text
<type>(<scope>): <subject>
```

常见 type：`daily`、`notes`、`exp`、`project`、`docs`、`chore`。链上地址与 tx hash 写在 commit body，不要写进 subject。

## Monad Agent Skills

本仓库安装了 [monskills](https://github.com/therealharpaljadeja/monskills)，供 Cursor 等 AI Agent 在 Monad 开发时引用最新链上知识（合约、钱包、Gas、索引等）。

### 安装

```shell
npx skills add therealharpaljadeja/monskills -y
```

安装后文件位于 `.agents/skills/monskill/`，版本锁定在 `skills-lock.json`。

### 更新

检查是否有新版本：

```shell
npx skills check
```

更新全部已安装的 skills：

```shell
npx skills update
```

更新完成后，将 `.agents/` 与 `skills-lock.json` 的变更一并提交，便于同步到其他环境。

## Monad 官方文档（LLM）

官方文档 LLM 导出位于 `notes/monad/llms-full.txt`（来源：https://docs.monad.xyz/llms-full.txt），与 monskills 配合使用：skills 负责开发流程路由，llms-full 提供完整官方文档正文。

Cursor 已在 `.cursor/rules/monad-docs.mdc` 中配置：在 `experiments/`、`projects/` 下工作时，Agent 会检索该文件而非依赖过时知识。

### 更新文档快照

```shell
curl -fsSL -o notes/monad/llms-full.txt https://docs.monad.xyz/llms-full.txt
```

更新后提交 `notes/monad/llms-full.txt` 即可。

## 公开与隐私边界

这个学习空间默认只记录适合公开展示的学习过程和 Proof of Work。

不要提交：

- 私钥、助记词、API Key、Bearer Token、`.env`
- 未公开的会议链接、密码、内部资料
- 真实资金细节
- 未确认公开的项目策略或队友个人信息

## 每日最小产出

每天至少留下一个小 artifact：

- 一篇 daily note
- 一个链上交互记录
- 一个小代码实验
- 一个项目决策记录
- 一个打卡草稿
- 一个可以复用到作品集的片段
