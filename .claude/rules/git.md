# Git Commit Rules / Gitコミットルール

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<prefix>: <summary>
```

## Prefixes / プレフィックス

- `feat` — 新機能
- `fix` — バグ修正
- `refactor` — コードの再構成（動作変更なし）
- `docs` — ドキュメントのみ
- `test` — テストの追加・更新
- `chore` — ビルド、設定、依存関係、CI
- `perf` — パフォーマンス改善
- `style` — フォーマット、lint（ロジック変更なし）

## Rules / ルール

- サマリーは小文字、命令形、ピリオドなし
- 1行目は72文字以内に収める
- 重要な変更には本文を追加する（空行で区切る）
- サマリーは英語で記述し、本文は日本語で記述してもよい
