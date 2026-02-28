# agent/lib/30_git.sh — Git helpers

ensure_clean_main() {
  cd "$REPO_ROOT"
  local current_branch
  current_branch=$(git branch --show-current)
  if [[ "$current_branch" != "main" ]]; then
    log "WARN: Not on main (on '$current_branch'). Switching to main."
    git reset HEAD -- . 2>/dev/null || true
    git checkout -- . 2>/dev/null || true
    git clean -fd 2>/dev/null || true
    git checkout main
  fi
  if ! git diff --quiet || ! git diff --cached --quiet; then
    log "WARN: Working tree is dirty on main. Resetting."
    git reset HEAD -- . 2>/dev/null || true
    git checkout -- . 2>/dev/null || true
    git clean -fd 2>/dev/null || true
  fi
  # Fetch latest remote state before pulling
  log "Fetching latest from origin..."
  if ! git fetch origin 2>/dev/null; then
    log "WARN: git fetch origin failed. Continuing with local state."
  fi
  if ! git pull --ff-only origin main 2>/dev/null; then
    log "WARN: git pull --ff-only failed. Attempting reset to origin/main."
    git reset --hard origin/main 2>/dev/null || true
  fi
}

verify_main_is_latest() {
  cd "$REPO_ROOT"
  local local_head remote_head
  local_head=$(git rev-parse HEAD)
  remote_head=$(git rev-parse origin/main 2>/dev/null) || true
  if [[ -z "$remote_head" ]]; then
    log "WARN: Could not resolve origin/main. Skipping verification."
    return 0
  fi
  if [[ "$local_head" != "$remote_head" ]]; then
    log "ERROR: Local main ($local_head) does not match origin/main ($remote_head)."
    log "Attempting to sync..."
    git fetch origin 2>/dev/null || true
    git reset --hard origin/main 2>/dev/null || true
    # Re-check after sync
    local_head=$(git rev-parse HEAD)
    remote_head=$(git rev-parse origin/main 2>/dev/null) || true
    if [[ "$local_head" != "$remote_head" ]]; then
      log "ERROR: Still out of sync after reset. Aborting iteration."
      return 1
    fi
    log "Synced to origin/main successfully."
  fi
  return 0
}

cleanup_branch() {
  local branch="$1"
  cd "$REPO_ROOT"
  git reset HEAD -- . 2>/dev/null || true
  git checkout -- . 2>/dev/null || true
  git clean -fd 2>/dev/null || true
  git checkout main 2>/dev/null || true
  git branch -D "$branch" 2>/dev/null || true
}

# Detect the Conventional Commits prefix from the branch's commit messages.
# Examines commits on the current branch (vs main) and returns the most common prefix.
# Falls back to "feat" if no valid prefix is found.
detect_commit_prefix() {
  cd "$REPO_ROOT"
  local commits prefix_line prefix
  commits=$(git log main..HEAD --format="%s" 2>/dev/null || echo "")
  if [[ -z "$commits" ]]; then
    echo "feat"
    return
  fi
  # Extract the prefix from the first commit (most representative of the task)
  prefix_line=$(echo "$commits" | tail -n 1)
  prefix=$(echo "$prefix_line" | grep -oE '^(feat|fix|refactor|docs|test|chore|perf|style)' | head -1)
  if [[ -n "$prefix" ]]; then
    echo "$prefix"
  else
    echo "feat"
  fi
}

# Check if any Rust-related files changed on the current branch vs main
has_rust_changes() {
  cd "$REPO_ROOT"
  local changed_files
  changed_files=$(git diff --name-only main...HEAD 2>/dev/null || git diff --name-only main 2>/dev/null || echo "")
  if [[ -z "$changed_files" ]]; then
    # If we can't determine changes, assume Rust changes to be safe
    return 0
  fi
  echo "$changed_files" | grep -qE '\.(rs|toml|lock)$|^Cargo\.'
}

# Stage changes safely — tracked modifications + untracked source files only.
# Avoids `git add -A` which can include temp files, logs, and other artifacts.
git_add_safe() {
  cd "$REPO_ROOT"
  # Stage all tracked file modifications and deletions
  git add -u
  # Selectively stage untracked files matching known source patterns
  local untracked
  untracked=$(git ls-files --others --exclude-standard)
  if [[ -n "$untracked" ]]; then
    local add_failed=0
    while IFS= read -r f; do
      if ! git add -- "$f"; then
        log "WARN: git add failed for: $f"
        add_failed=1
      fi
    done < <(echo "$untracked" | grep -E '\.(rs|toml|lock|ts|tsx|js|jsx|json|css|html|md|sh|yaml|yml|svg|png)$')
    if [[ "$add_failed" -ne 0 ]]; then
      log "WARN: Some files failed to stage"
    fi
  fi
}

# Commit uncommitted changes with formatter retry on pre-commit hook failure.
# If `git commit` fails (e.g. pre-commit hook), re-runs formatters and retries.
# Usage: commit_with_formatter_retry "commit message"
# Returns 0 if committed (or nothing to commit), non-zero on failure.
commit_with_formatter_retry() {
  local commit_msg="$1"
  cd "$REPO_ROOT"

  # Nothing to commit?
  if git diff --quiet && git diff --cached --quiet && [[ -z "$(git ls-files --others --exclude-standard)" ]]; then
    return 0
  fi

  log "WARN: Uncommitted changes found. Committing..."
  git_add_safe
  if git commit -m "$commit_msg" 2>/dev/null; then
    return 0
  fi

  # Pre-commit hook failed — run formatters and retry
  log "WARN: Commit failed (pre-commit hook). Re-running formatters..."
  cargo fmt --all 2>/dev/null || true
  if has_frontend_changes; then
    (cd "$REPO_ROOT/frontend" && npx prettier --write src/ 2>/dev/null) || true
    (cd "$REPO_ROOT/frontend" && npx eslint --fix src/ 2>/dev/null) || true
  fi
  git_add_safe
  git commit -m "$commit_msg" 2>/dev/null || true
}

# Check if any frontend-related files changed on the current branch vs main
has_frontend_changes() {
  cd "$REPO_ROOT"
  local changed_files
  changed_files=$(git diff --name-only main...HEAD 2>/dev/null || git diff --name-only main 2>/dev/null || echo "")
  if [[ -z "$changed_files" ]]; then
    return 1
  fi
  echo "$changed_files" | grep -qE '^frontend/'
}
