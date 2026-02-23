# reown

> エージェントPRの嵐の時代でも、コードベースを自分のものに。

## reownとは？

AIエージェントが大量のPRを生成する時代に、コードベースを把握し続けたい開発者のためのネイティブデスクトップGitツールです。

コードを1行ずつレビューする代わりに、reownではワークツリー、ブランチ、差分を単一のインタラクティブなインターフェースから管理できます。Tauri + Rust で構築されたmacOSネイティブアプリです。

---

## 機能（Phase 1 — Git GUI基盤）

- **ワークツリー管理** — すべてのワークツリーをブランチとパス付きで一覧表示。ワンキーで新規作成
- **ブランチ管理** — ローカルブランチの一覧、作成、切り替え、削除
- **Diffビューア** — 変更ファイルを閲覧し、シンタックスハイライト付きの追加/削除差分を表示

---

## プロジェクト構成

### ディレクトリ構造

```
reown/
├── Cargo.toml              # ワークスペースルート（lib + app）
├── Cargo.lock
├── README.md
├── CLAUDE.md               # 開発ガイドライン
├── mise.toml               # ツールバージョン管理（Node.js, Rust）
│
├── lib/                    # 共有ライブラリ（reown クレート）
│   ├── lib.rs              #   クレートルート — git, github, ui を再エクスポート
│   ├── git/
│   │   ├── mod.rs          #   open_repo() + サブモジュール再エクスポート
│   │   ├── branch.rs       #   BranchInfo, ブランチ操作（一覧/作成/切替/削除）
│   │   ├── diff.rs         #   FileDiff, DiffChunk, diff_workdir(), diff_commit()
│   │   ├── worktree.rs     #   WorktreeInfo, ワークツリー操作（一覧/追加）
│   │   └── test_utils.rs   #   テスト用ユーティリティ
│   ├── github/
│   │   ├── mod.rs          #   サブモジュール再エクスポート
│   │   ├── pull_request.rs #   PrInfo, list_pull_requests()
│   │   └── types.rs        #   GitHub API レスポンス型
│   └── ui/
│       ├── mod.rs          #   サブモジュール再エクスポート
│       └── pull_request.rs #   PR表示用ユーティリティ
│
├── app/                    # Tauri デスクトップアプリ（エントリポイント）
│   ├── Cargo.toml          #   アプリ固有の依存関係（tauri, reown）
│   ├── build.rs            #   Tauri ビルドスクリプト
│   ├── tauri.conf.json     #   Tauri 設定（ウィンドウサイズ、バンドラー等）
│   ├── src/
│   │   ├── main.rs         #   #[tauri::command] ハンドラ + アプリ起動
│   │   └── error.rs        #   AppError 構造体（フロントエンド向けエラー型）
│   └── icons/
│       └── icon.png        #   アプリアイコン
│
├── frontend/               # Web フロントエンド（React + TypeScript）
│   ├── package.json        #   NPM 依存関係・スクリプト
│   ├── vite.config.ts      #   Vite ビルド設定
│   ├── tsconfig.json       #   TypeScript 設定
│   ├── index.html          #   HTML エントリポイント
│   └── src/
│       ├── main.tsx        #   React エントリポイント
│       ├── App.tsx         #   メインアプリ（タブ UI）
│       ├── types.ts        #   TypeScript 型定義（Rust 構造体のミラー）
│       ├── invoke.ts       #   Tauri IPC ラッパー
│       ├── style.css       #   グローバルスタイル
│       ├── components/     #   UI コンポーネント
│       └── i18n/           #   多言語対応（日本語/英語）
│
├── docs/                   # ドキュメント
│   └── INTENT.md           #   プロダクトビジョン
│
├── agent/                  # 自律エージェントワークフロー
│   ├── loop.sh             #   メインオーケストレーションループ
│   ├── lib/                #   共通ライブラリ（設定、ログ、Git操作等）
│   ├── steps/              #   ワークフローステップ（トリアージ→実装→検証→PR）
│   └── prompts/            #   エージェント用プロンプト
│
└── .github/                # GitHub 設定
    ├── workflows/ci.yml    #   CI パイプライン（Rust + Frontend）
    └── ISSUE_TEMPLATE/     #   Issue テンプレート
```

### Cargo ワークスペース構成

本プロジェクトは Cargo ワークスペースで構成されており、2つのメンバークレートを持ちます。

| クレート | パス | 種別 | 説明 |
|---------|------|------|------|
| `reown` | `.` (ルート) | ライブラリ | Git/GitHub 操作のコアロジック |
| `reown-app` | `app/` | バイナリ | Tauri デスクトップアプリ |

### 依存関係

```
┌─────────────────────────────────────────────────────┐
│                   frontend/                          │
│          React + TypeScript + Vite                   │
│       Tauri IPC (invoke) でコマンド呼び出し            │
└──────────────────────┬──────────────────────────────┘
                       │ Tauri IPC
┌──────────────────────▼──────────────────────────────┐
│                     app/                             │
│           Tauri コマンドハンドラ                       │
│    #[tauri::command] で reown ライブラリを呼び出し      │
└──────────────────────┬──────────────────────────────┘
                       │ Rust クレート依存
┌──────────────────────▼──────────────────────────────┐
│                     lib/                             │
│              reown ライブラリ                          │
│     git2 による Git 操作 / reqwest による GitHub API    │
└─────────────────────────────────────────────────────┘
```

**主要な依存クレート:**

- **git2** — libgit2 バインディング（Git 操作）
- **anyhow** — エラーハンドリング
- **serde / serde_json** — シリアライゼーション（Tauri IPC）
- **reqwest** — HTTP クライアント（GitHub API）
- **tauri** — デスクトップアプリフレームワーク

---

## セットアップ

### 前提条件

- [Rust](https://rustup.rs/)
- [mise](https://mise.jdx.dev/) — Node.js バージョン管理に使用

### Node.js のインストール

```sh
# mise をインストール（未インストールの場合）
curl https://mise.run | sh

# Node.js をインストール（.mise.toml の設定に従い自動でバージョンが選択される）
mise install
```

---

## ビルド・テスト・開発

### Rust（ライブラリ + アプリ）

```sh
cargo build                                # ワークスペース全体をビルド
cargo test                                 # 全テスト実行
cargo clippy --all-targets -- -D warnings  # リント（警告をエラーとして扱う）
```

### フロントエンド

```sh
cd frontend
npm ci                  # 依存関係インストール
npm run dev             # Vite 開発サーバー起動
npm run build           # TypeScript コンパイル + Vite ビルド
npm run lint            # ESLint チェック
npm run typecheck       # TypeScript 型チェック
npm run format          # Prettier フォーマット
```

### Tauri アプリ

```sh
cd app && cargo tauri dev     # 開発モード（ホットリロード付き）
cd app && cargo tauri build   # リリースビルド（.app バンドル生成）

# ビルドされた .app を起動
open app/target/release/bundle/macos/reown.app
```

---

## 技術スタック

- **言語**: Rust
- **デスクトップ**: [Tauri 2](https://tauri.app) (macOSネイティブ .app バンドル)
- **フロントエンド**: React 19 / TypeScript / [Vite](https://vite.dev) / [TailwindCSS 4](https://tailwindcss.com)
- **UI**: [Radix UI](https://www.radix-ui.com/) / [i18next](https://www.i18next.com/)（日本語/英語）
- **Git**: [git2-rs](https://github.com/rust-lang/git2-rs) (libgit2バインディング)
- **GitHub API**: [reqwest](https://github.com/seanmonstar/reqwest)
- **CI**: GitHub Actions（Rust ビルド/テスト/clippy + フロントエンド lint/typecheck/build）

---

## ロードマップ

### Phase 1 — Git GUI基盤 ✅
- [x] ワークツリーの一覧表示とステータス表示
- [x] ブランチの作成、切り替え、削除
- [x] Diff表示（ファイルレベル・チャンクレベル）
- [x] ワンキーでのワークツリー作成

### Phase 2 — PRサポート
- [ ] PR説明文の自動生成（diff → AI経由で説明文）
- [ ] GitHub APIからのPRリスト取得
- [ ] 抽象レイヤーのレビュー支援（影響範囲、意図の要約）

### Phase 3 — 開発体験の強化
- [ ] コードベース状態からの開発タスク提案
- [ ] エージェントPRのトリアージ支援（優先度、リスク、影響の分類）
- [ ] ワークフローのカスタマイズ
