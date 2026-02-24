# 開発ガイド

## 前提条件

- [Rust](https://rustup.rs/)
- [mise](https://mise.jdx.dev/) — Node.js バージョン管理に使用

## セットアップ

```sh
# mise をインストール（未インストールの場合）
curl https://mise.run | sh

# Node.js をインストール（.mise.toml の設定に従い自動でバージョンが選択される）
mise install
```

## ビルド・テスト

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
