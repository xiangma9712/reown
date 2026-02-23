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
  lib.rs                    — crate root, re-exports git, github
  git/
    mod.rs                  — re-exports branch, diff, worktree
    branch.rs               — BranchInfo, list/create/switch/delete branches
    diff.rs                 — FileDiff, DiffChunk, diff_workdir(), diff_commit()
    worktree.rs             — WorktreeInfo, list/add worktrees
  github/
    mod.rs                  — re-exports pull_request, types
    pull_request.rs         — PrInfo, list_pull_requests()
    types.rs                — GitHub API response types

app/                        — Tauri desktop app (entry point)
  src/main.rs               — Tauri commands (IPC bridge to reown lib)
  tauri.conf.json           — Tauri config, bundler settings
  build.rs                  — Tauri build script

frontend/                   — Web frontend (HTML/CSS/JS)
  src/index.html            — App shell
  src/style.css             — Styles
  src/main.js               — Frontend logic, Tauri invoke calls
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

## Autonomous Agent

エージェントとして実行する場合は `agent/prompts/` 配下のプロンプトに従うこと。
タスク実装時は `agent/prompts/implement.md` を参照。
