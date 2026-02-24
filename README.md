# reown

> エージェントPRの嵐の時代でも、コードベースを自分のものに。

> [!WARNING]
> このプロジェクトは**開発初期段階**です。機能はまだほとんど実装されておらず、プロダクトとしては使える状態ではありません。
> 現在は主に **Claude Code を活用した自律エージェント開発ワークフロー (`agent/`)** の実験・紹介を目的として公開しています。

## reownとは？

AIエージェントが大量のPRを生成する時代に、コードベースを把握し続けたい開発者のためのネイティブデスクトップGitツールです。

コードを1行ずつレビューする代わりに、reownではワークツリー、ブランチ、差分を単一のインタラクティブなインターフェースから管理できます。Tauri + Rust で構築されたmacOSネイティブアプリです。

## Agent Loop

`agent/` ディレクトリに、Claude Code を使った自律エージェント開発ワークフローが含まれています。GitHub Issue を起点にトリアージ → 実装 → 検証 → PR作成 までを自動で行います。

詳しくは [`agent/`](./agent/) を参照してください。

## プロジェクト構成

```
reown/
├── lib/                    # 共有ライブラリ（Git/GitHub 操作のコアロジック）
├── app/                    # Tauri デスクトップアプリ（エントリポイント）
├── frontend/               # Web フロントエンド（React + TypeScript）
├── agent/                  # 自律エージェントワークフロー
├── docs/                   # ドキュメント
└── .github/                # CI / Issue テンプレート
```

```
frontend (React + TypeScript + Vite)
        │ Tauri IPC
app (Tauri コマンドハンドラ)
        │ Rust クレート依存
lib (git2 による Git 操作 / reqwest による GitHub API)
```

## 技術スタック

Rust / [Tauri 2](https://tauri.app) / React 19 / TypeScript / [Vite](https://vite.dev) / [TailwindCSS 4](https://tailwindcss.com) / [Radix UI](https://www.radix-ui.com/) / [git2-rs](https://github.com/rust-lang/git2-rs) / [reqwest](https://github.com/seanmonstar/reqwest)

## 開発

[docs/development.md](./docs/development.md) を参照してください。
