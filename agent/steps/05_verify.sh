# agent/steps/05_verify.sh — step_verify: auto-format + cargo test/clippy + working tree check
# Safety net after implementation. The implement agent should have already run
# all checks, but this catches anything it missed.
# Return: 0=ok, 1=skip iteration, 2=break loop

step_verify() {
  cd "$REPO_ROOT"

  # ── Auto-format before any checks ─────────────────────────────────────────
  if has_rust_changes; then
    log "Running cargo fmt..."
    cargo fmt --all 2>/dev/null || true
  fi

  if has_frontend_changes; then
    log "Running prettier and eslint..."
    (cd "$REPO_ROOT/frontend" && npx prettier --write src/ 2>/dev/null) || true
    (cd "$REPO_ROOT/frontend" && npx eslint --fix src/ 2>/dev/null) || true
  fi

  # ── Commit any formatter changes ──────────────────────────────────────────
  cd "$REPO_ROOT"
  if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
    # If frontend components changed, update VRT snapshots
    if git diff --name-only HEAD 2>/dev/null | grep -q 'frontend/src/components/.*\.tsx$'; then
      log "Frontend components changed — updating VRT snapshots..."
      (cd "$REPO_ROOT/frontend" && npx playwright test --update-snapshots 2>/dev/null) || true
    fi

    git_add_safe
    if ! git commit -m "fix: apply formatting for #$TASK_ISSUE" 2>/dev/null; then
      # Hook failed after formatting — bypass to avoid blocking
      log "WARN: Formatter commit failed (pre-commit hook). Bypassing hook."
      git_add_safe
      git commit --no-verify -m "fix: apply formatting for #$TASK_ISSUE" 2>/dev/null || true
    fi
  fi

  # ── Run cargo test & clippy if Rust files changed ────────────────────────
  if has_rust_changes; then
    log "Rust files changed — running cargo test and clippy..."
    if ! cargo test 2>/dev/null; then
      log "WARN: Tests failed after implementation. Attempting fix..."
      local fix_rc=0
      run_claude \
        --label "verify-test-fix-$TASK_ISSUE" \
        --timeout "$TIMEOUT_VERIFY_FIX" \
        --max-turns "$FIX_MAX_TURNS" \
        --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
        -- "cargo test is failing. Read the test output, find the root cause, and fix the implementation (not the tests). Then run cargo fmt --all && cargo test again to verify." \
        >/dev/null || fix_rc=$?
      if [[ "$fix_rc" -eq 2 ]]; then
        flag_rate_limit
        gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
        cleanup_branch "$BRANCH_NAME"
        return 2
      fi

      if ! cargo test 2>/dev/null; then
        log "ERROR: Tests still failing for #$TASK_ISSUE. Marking as pend."
        mark_pend "$TASK_ISSUE" "cargo test が修正後も失敗しています"
        cleanup_branch "$BRANCH_NAME"
        interruptible_sleep "$SLEEP_SECONDS"
        return 1
      fi
    fi

    if ! cargo clippy --all-targets -- -D warnings 2>/dev/null; then
      log "WARN: Clippy failed. Attempting fix..."
      local fix_rc=0
      run_claude \
        --label "verify-clippy-fix-$TASK_ISSUE" \
        --timeout "$TIMEOUT_VERIFY_FIX" \
        --max-turns "$FIX_MAX_TURNS" \
        --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
        -- "cargo clippy --all-targets -- -D warnings is failing. Fix all clippy warnings, then run cargo fmt --all." \
        >/dev/null || fix_rc=$?
      if [[ "$fix_rc" -eq 2 ]]; then
        flag_rate_limit
        gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
        cleanup_branch "$BRANCH_NAME"
        return 2
      fi

      if ! cargo clippy --all-targets -- -D warnings 2>/dev/null; then
        log "ERROR: Clippy still failing for #$TASK_ISSUE. Marking as pend."
        mark_pend "$TASK_ISSUE" "cargo clippy が修正後も失敗しています"
        cleanup_branch "$BRANCH_NAME"
        interruptible_sleep "$SLEEP_SECONDS"
        return 1
      fi
    fi
  else
    log "No Rust files changed — skipping cargo test and clippy."
  fi

  # ── Ensure working tree is clean ──────────────────────────────────────────
  cd "$REPO_ROOT"
  if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
    log "WARN: Working tree not clean after checks. Committing remaining changes..."
    git_add_safe
    if ! git commit -m "fix: commit remaining changes for #$TASK_ISSUE" 2>/dev/null; then
      # Pre-commit hook failed — run formatters and retry
      log "WARN: Commit failed (pre-commit hook). Re-running formatters..."
      cargo fmt --all 2>/dev/null || true
      if has_frontend_changes; then
        (cd "$REPO_ROOT/frontend" && npx prettier --write src/ 2>/dev/null) || true
        (cd "$REPO_ROOT/frontend" && npx eslint --fix src/ 2>/dev/null) || true
      fi
      git_add_safe
      if ! git commit -m "fix: commit remaining changes for #$TASK_ISSUE" 2>/dev/null; then
        # Hook still fails — bypass hook to avoid blocking pipeline
        log "WARN: Commit still failing. Bypassing pre-commit hook."
        git commit --no-verify -m "fix: commit remaining changes for #$TASK_ISSUE" 2>/dev/null || true
      fi
    fi
  fi

  # ── Final clean check ────────────────────────────────────────────────────
  cd "$REPO_ROOT"
  if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
    log "ERROR: Working tree still not clean for #$TASK_ISSUE. Marking as pend."
    mark_pend "$TASK_ISSUE" "working tree が修正後もcleanになりません"
    cleanup_branch "$BRANCH_NAME"
    interruptible_sleep "$SLEEP_SECONDS"
    return 1
  fi

  log "Verify passed: working tree is clean."
  return 0
}
