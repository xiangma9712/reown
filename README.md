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

## 使い方

```sh
# 開発モード（ホットリロード付き）
cd src-tauri && cargo tauri dev

# リリースビルド（.appバンドル生成）
cd src-tauri && cargo tauri build

# ビルドされた.appを起動
open src-tauri/target/release/bundle/macos/reown.app
```

---

## 技術スタック

- **言語**: Rust
- **デスクトップ**: [Tauri 2](https://tauri.app) (macOSネイティブ .app バンドル)
- **フロントエンド**: HTML / CSS / JavaScript
- **Git**: [git2-rs](https://github.com/rust-lang/git2-rs) (libgit2バインディング)

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
