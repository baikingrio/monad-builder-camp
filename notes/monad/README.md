# Monad 官方文档（LLM 版）

本目录存放 Monad 官方文档的 LLM 友好导出，供 AI Agent 与本地查阅。

| 文件 | 来源 |
|------|------|
| `llms-full.txt` | https://docs.monad.xyz/llms-full.txt |

## 更新

```shell
curl -fsSL -o notes/monad/llms-full.txt https://docs.monad.xyz/llms-full.txt
```

更新后建议快速确认文件非空，并将变更提交到仓库。

## 使用方式

- **Cursor Agent**：`.cursor/rules/monad-docs.mdc` 会引导 Agent 在此文件中检索 Monad 相关答案
- **人工查阅**：直接打开 `llms-full.txt`，或用 `grep` 搜索关键词（如 `chain_id`、`testnet`、`gas`）
