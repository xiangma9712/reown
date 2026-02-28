# Agent Loop ワークフロー

## 全体像

```
setup → triage → select → implement → verify → review → push → ci → complete
```

9ステップの直列パイプライン。各ステップは `0=ok, 1=skip(次のイテレーションへ), 2=break(ループ終了)` を返す。

## ステップ詳細

### 1. setup (`01_setup.sh`)
- main ブランチを最新に同期
- GitHub から `agent` ラベル付きの open issue を取得
- issue が 0 件の場合、`propose_issues()` で INTENT.md からタスクを提案

### 2. triage (`02_triage.sh`)
- 未トリアージの issue（`planned`, `doing`, `done`, `needs-split`, `pend` のいずれのラベルもない）を検出
- roadmap エージェントでトリアージ → `planned` + 優先度ラベルを付与
- `needs-split` の issue があればサブ issue に分割

### 3. select (`03_select.sh`)
- `planned` ラベル付きの issue から最高優先度のものを 1 件選択
- 優先度順: `priority-high` > `priority-middle` > `priority-low` > なし
- 同一優先度内では issue 番号が小さい（古い）ものを優先

### 4. implement (`04_implement.sh`)
- `doing` ラベルを付与し、作業ブランチ `agent/issue-{N}` を作成
- 事前チェック: 要件が既に満たされていれば issue をクローズ
- 実装エージェントを起動（品質チェック全責任を持つ）
- **失敗時は `pend`** に設定（`needs-split` は triage のみ使用）

### 5. verify (`05_verify.sh`)
- セーフティネット: 実装エージェントが見落とした問題をキャッチ
- 自動フォーマット: `cargo fmt`, `prettier --write`, `eslint --fix`
- `cargo test` + `cargo clippy` の再確認（Rust 変更時のみ）
- working tree がクリーンであることを保証

### 6. review (`05b_review.sh`)
- スマートレビュー: diff を分析し、指摘を blocking / followup に分類
- **blocking の基準（5項目のみ）**: セキュリティ脆弱性、クラッシュ/パニック、データ損失、致命的なエラーハンドリング欠如、要件未充足
- blocking あり → fix エージェントで1回だけ修正を試行
- fix 失敗 → 全 blocking を followup に降格（パイプラインを止めない）
- followup → GitHub issue を自動作成（`agent` ラベル付き）
- **review は決してパイプラインを止めない**（return 1 を使わない）
- タイムアウト・エラー・JSON解析失敗 → pass 扱い

### 7. push (`06_push.sh`)
- ブランチを origin に push
- ローカルとリモートの同期を確認
- PR を作成（Conventional Commits prefix を自動検出）
- PR の diff が空でないことを確認

### 8. ci (`07_ci.sh`)
- CI 完了を待機（ポーリング）
- CI 失敗時は fix エージェントで修正 → 再 push（最大 5 回）
- 全試行失敗で `pend` に設定

### 9. complete (`08_complete.sh`)
- PR を squash merge
- issue に `done` ラベル付与 + クローズ
- main に戻って pull

## ラベルライフサイクル

```
[新規 issue]
    │ agent ラベル付与
    ▼
  triage → planned + priority-{high,middle,low}
    │
    ▼
  select → doing
    │
    ├─ 成功 → done → issue クローズ
    ├─ 失敗 → pend（再試行可能、人間のレビュー待ち）
    └─ 大きすぎ → needs-split（triage のみが設定）→ サブ issue に分割
```

| ラベル | 意味 | 設定者 |
|--------|------|--------|
| `agent` | エージェントタスクプール | 人間 |
| `planned` | トリアージ済み、実装待ち | triage |
| `doing` | 作業中 | implement |
| `done` | 完了 | complete |
| `pend` | ブロック中（失敗詳細は issue コメント参照）| implement, verify, push, ci |
| `needs-split` | 分割が必要 | triage のみ |
| `self-review` | ループ自己修正用 | failure tracking |

## 品質保証の設計

**品質責任は実装エージェントに集約。** 後段は最小限のセーフティネット。

```
implement (品質の主責任)
  └─ cargo fmt → build → test → clippy
  └─ prettier → eslint → tsc
  └─ Stories + VRT スナップショット更新
  └─ 自己レビューチェックリスト

verify (セーフティネット)
  └─ 自動フォーマット再実行
  └─ test/clippy 再確認
  └─ working tree クリーン保証

review (スマートレビュー)
  └─ diff を blocking / followup に分類
  └─ blocking は1回だけ修正試行、失敗時は followup に降格
  └─ followup は issue 化して後で対応
  └─ パイプラインを決して止めない

ci (最終ゲート)
  └─ GitHub Actions: test, clippy, fmt, prettier, eslint, typecheck, build
  └─ 失敗時は fix エージェントで最大 5 回リトライ
```

## 失敗追跡と自己修正

各イテレーションの成功/失敗を記録し、失敗率に基づいて対応する。

| 条件 | アクション |
|------|-----------|
| 過去 5 回中 2 回以上失敗 | `self-review` issue を作成し、次のイテレーションで強制的に pick |
| `self-review` タスク自体が失敗 | ループを終了 |
| 過去 5 回中 4 回以上失敗 | ループを即座に終了 |

### pend 時の失敗記録

`pend` に設定する際、issue コメントに以下の情報を含める:
- 失敗理由
- 直近のイテレーションログ（progress.txt の最終 30 行）
- 失敗したステップの Claude エージェントの出力（末尾）

これにより、人間が issue コメントを見るだけで失敗の原因を特定できる。

## ファイル構成

```
agent/
├── loop.sh                     # メインループ
├── workflow.md                 # このファイル
├── prompts/
│   ├── implement.md            # 実装エージェントプロンプト
│   ├── review.md               # スマートレビュープロンプト
│   ├── verify.md               # 事前/事後検証プロンプト
│   ├── roadmap.md              # トリアージプロンプト
│   ├── split.md                # issue 分割プロンプト
│   └── propose.md              # issue 提案プロンプト
├── steps/
│   ├── 01_setup.sh             # setup
│   ├── 02_triage.sh            # triage
│   ├── 03_select.sh            # select
│   ├── 04_implement.sh         # implement
│   ├── 05_verify.sh            # verify
│   ├── 05b_review.sh           # review (smart review)
│   ├── 06_push.sh              # push
│   ├── 07_ci.sh                # ci
│   └── 08_complete.sh          # complete
└── lib/
    ├── 00_config.sh            # デフォルト設定
    ├── 10_log.sh               # ログ + イテレーションログ管理
    ├── 15_run_claude.sh         # claude -p ラッパー
    ├── 20_rate_limit.sh         # レートリミット検出
    ├── 30_git.sh               # Git ヘルパー
    ├── 35_cleanup.sh           # ラベルクリーンアップ
    ├── 40_github.sh            # GitHub API + ラベル管理
    └── 50_failure_tracking.sh  # 失敗追跡 + 自己修正
```
