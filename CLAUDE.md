# reown

Tauri デスクトップ Git ツール (Rust + Web frontend)。See @README.md for details.
See @docs/INTENT.md for the product vision (4 pillars: review-support, local-gui, automation, dev-support).

## コミュニケーション

- **日本語でコミュニケーションする** — Issue、PR、コミットメッセージの本文、ドキュメントは日本語で記述する
- コミットメッセージのprefix（feat, fix等）は英語のまま使用する

## Build & Test

```bash
cargo build
cargo test
cargo clippy --all-targets -- -D warnings
```

## Architecture

```
lib/                        — shared library (reown crate)
  lib.rs                    — crate root, re-exports git, github, ui
  git/
    mod.rs                  — open_repo() + re-exports branch, diff, worktree
    branch.rs               — BranchInfo, list/create/switch/delete branches
    diff.rs                 — FileDiff, DiffChunk, diff_workdir(), diff_commit()
    worktree.rs             — WorktreeInfo, list/add worktrees
    test_utils.rs           — shared test utilities
  github/
    mod.rs                  — re-exports pull_request, types
    pull_request.rs         — PrInfo, list_pull_requests()
    types.rs                — GitHub API response types
  ui/
    mod.rs                  — re-exports pull_request
    pull_request.rs         — PR display utilities

app/                        — Tauri desktop app (entry point)
  src/main.rs               — Tauri commands (IPC bridge to reown lib)
  src/error.rs              — AppError struct (structured error for frontend)
  tauri.conf.json           — Tauri config, bundler settings
  build.rs                  — Tauri build script

frontend/                   — Web frontend (React + TypeScript)
  src/main.tsx              — React entry point
  src/App.tsx               — Main app component (tab UI)
  src/types.ts              — TypeScript type definitions (mirrors Rust structs)
  src/invoke.ts             — Tauri IPC wrapper
  src/components/           — UI components (ReviewTab, TodoTab, BranchSelector, Layout, etc.)
  src/i18n/                 — i18n (ja/en)
```

## Key Patterns

- **Error handling**: `anyhow::Result` everywhere, `with_context()` for messages
- **Repo discovery**: `Repository::discover(path)` — never hardcode repo paths
- **Tests**: `tempfile::TempDir` + `Repository::init()` for isolated git repos
- **Tauri commands**: Functions in `app/src/main.rs` wrap library calls and convert errors to strings
- **Serialization**: All data types use `serde::Serialize` for Tauri IPC

## Adding a New Feature

1. Add types/logic in `lib/git/<module>.rs` (or new module)
2. Re-export from `lib/git/mod.rs`
3. Add `#[tauri::command]` wrapper in `app/src/main.rs`
4. Register the command in `tauri::generate_handler![]`
5. Add frontend UI in `frontend/src/`
6. Write tests using tempfile pattern

## Frontend: Storybook & VRT

- コンポーネント（`frontend/src/components/*.tsx`）を修正・追加した場合、対応する Stories（`*.stories.tsx`）と VRT スペック（`frontend/e2e/vrt/*.spec.ts`）も必ず更新すること
- アニメーション系テスト（Loading, Spinner等）には `maxDiffPixelRatio: 0.08` を設定すること

## Autonomous Agent

エージェントとして実行する場合は `agent/prompts/` 配下のプロンプトに従うこと。
タスク実装時は `agent/prompts/implement.md` を参照。
