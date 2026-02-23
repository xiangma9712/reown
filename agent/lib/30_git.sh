# agent/lib/30_git.sh — Git helpers

ensure_clean_main() {
  cd "$REPO_ROOT"
  local current_branch
  current_branch=$(git branch --show-current)
  if [[ "$current_branch" != "main" ]]; then
    log "WARN: Not on main (on '$current_branch'). Switching to main."
    git checkout -- . 2>/dev/null || true
    git clean -fd 2>/dev/null || true
    git checkout main
  fi
  if ! git diff --quiet || ! git diff --cached --quiet; then
    log "WARN: Working tree is dirty on main. Resetting."
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
  git checkout -- . 2>/dev/null || true
  git clean -fd 2>/dev/null || true
  git checkout main 2>/dev/null || true
  git branch -D "$branch" 2>/dev/null || true
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
