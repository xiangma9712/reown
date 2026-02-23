# reown

Rust TUI Git tool built with ratatui + git2-rs. See @README.md for details.
See @docs/INTENT.md for the product vision (4 pillars: review-support, local-gui, automation, dev-support).

## Build & Test

```bash
cargo build
cargo test
cargo clippy --all-targets -- -D warnings
```

## Architecture

```
src/
  main.rs          — entry point, terminal setup, event loop, draw()
  app.rs           — App state, View/InputMode enums, navigation & actions
  git/
    mod.rs         — re-exports branch, diff, worktree
    branch.rs      — BranchInfo, list/create/switch/delete branches
    diff.rs        — FileDiff, DiffChunk, diff_workdir(), diff_commit()
    worktree.rs    — WorktreeInfo, list/add worktrees
  ui/
    mod.rs         — re-exports branch, diff, worktree renderers
    branch.rs      — render_branches()
    diff.rs        — render_diff()
    worktree.rs    — render_worktrees()
```

## Key Patterns

- **Error handling**: `anyhow::Result` everywhere, `with_context()` for messages
- **Repo discovery**: `Repository::discover(path)` — never hardcode repo paths
- **Tests**: `tempfile::TempDir` + `Repository::init()` for isolated git repos
- **UI rendering**: Each view has `render_<view>(frame, area, data, selection, focused)`
- **State**: Single `App` struct holds all state; `refresh()` reloads everything

## Adding a New Feature

1. Add types/logic in `src/git/<module>.rs` (or new module)
2. Re-export from `src/git/mod.rs`
3. Add fields to `App` struct in `src/app.rs`
4. Initialize in `App::new()`, refresh in `App::refresh()`
5. Add renderer in `src/ui/<module>.rs`, re-export from `src/ui/mod.rs`
6. Wire up view switching + keybindings in `main.rs`
7. Write tests using tempfile pattern

## Autonomous Agent Rules

When running as an autonomous agent (via `agent/loop.sh`):

- **One task per iteration** — implement exactly one prd.json task per run
- **Never modify prd.json** — only loop.sh updates task status
- **Never modify progress.txt** — only loop.sh appends entries
- **Tests are mandatory** — `cargo test` must pass before committing
- **Clippy must pass** — `cargo clippy --all-targets -- -D warnings`
- **Fix code, not tests** — if tests fail, fix the implementation
- **Conventional Commits** — see `.claude/rules/git.md`
- **Branch naming** — `agent/<task-id>` (e.g., `agent/phase2-001`)
- **No direct push to main** — always create a PR
