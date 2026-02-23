# reown

> Own your codebase again, even in the age of agent PR storm.

## What is reown?

A TUI (terminal UI) Git tool for developers who want to stay on top of their codebase even when AI agents are generating a flood of PRs.

Instead of reviewing code line-by-line, reown lets you manage your worktrees, branches, and diffs from a single interactive interface — inspired by lazygit.

---

## Features (Phase 1 — Git GUI Foundation)

- **Worktree management** — list all worktrees with their branch and path; create new ones with one keystroke
- **Branch management** — list, create, switch, and delete local branches
- **Diff viewer** — browse changed files and view diffs with syntax-highlighted additions/deletions

---

## Usage

```sh
# Build
cargo build --release

# Run in the current directory's repo
./target/release/reown

# Run against a specific repo
./target/release/reown /path/to/repo
```

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Cycle through views (Worktrees → Branches → Diff) |
| `w` | Go to Worktrees view |
| `b` | Go to Branches view |
| `d` | Go to Diff view |
| `↑` / `k` | Move up |
| `↓` / `j` | Move down |
| `↵` | Switch to selected branch (Branches view) |
| `c` | Create branch / worktree |
| `x` / `Del` | Delete selected branch |
| `r` | Refresh |
| `q` / `Ctrl-C` | Quit |

---

## Tech Stack

- **Language**: Rust
- **TUI**: [ratatui](https://ratatui.rs) + crossterm
- **Git**: [git2-rs](https://github.com/rust-lang/git2-rs) (libgit2 bindings)

---

## Roadmap

### Phase 1 — Git GUI Foundation ✅
- [x] Worktree listing and status display
- [x] Branch creation, switching, deletion
- [x] Diff display (file-level and chunk-level)
- [x] One-keystroke worktree creation

### Phase 2 — PR Support
- [ ] Auto-generate PR descriptions (diff → description via AI)
- [ ] PR list from GitHub API
- [ ] Abstract-layer review assistance (impact range, intent summary)

### Phase 3 — Enhanced Developer Experience
- [ ] Development task suggestions from codebase state
- [ ] Agent PR triage assistance (priority, risk, impact classification)
- [ ] Workflow customization
