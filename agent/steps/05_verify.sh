# agent/steps/05_verify.sh — step_verify: cargo test + clippy + working tree check
# Return: 0=ok, 1=skip iteration, 2=break loop

step_verify() {
  cd "$REPO_ROOT"

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
        -- "cargo test is failing. Read the test output, find the root cause, and fix the implementation (not the tests). Then run cargo test again to verify." \
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
        -- "cargo clippy --all-targets -- -D warnings is failing. Fix all clippy warnings in the code you changed." \
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

  # ── Pre-push verification — ensure working tree is clean ─────────────────
  cd "$REPO_ROOT"
  local VERIFY_CLEAN_PASSED=false
  local verify_attempt
  for verify_attempt in 1 2; do
    if git diff --quiet && git diff --cached --quiet && [[ -z "$(git ls-files --others --exclude-standard)" ]]; then
      VERIFY_CLEAN_PASSED=true
      break
    fi

    if [[ "$verify_attempt" -eq 1 ]]; then
      log "WARN: Working tree not clean before push. Attempting to commit remaining changes..."
      git add -A
      git commit -m "fix: commit remaining changes for #$TASK_ISSUE" 2>/dev/null || true

      # Re-run tests/clippy after committing leftover changes (only if Rust files changed)
      if has_rust_changes; then
        if ! cargo test 2>/dev/null || ! cargo clippy --all-targets -- -D warnings 2>/dev/null; then
          log "WARN: Tests/clippy failed after committing leftover changes. Invoking fix agent..."
          local fix_rc=0
          run_claude \
            --label "verify-leftover-fix-$TASK_ISSUE" \
            --timeout "$TIMEOUT_VERIFY_FIX" \
            --max-turns "$FIX_MAX_TURNS" \
            --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
            -- "There were uncommitted changes that have been staged and committed. Now cargo test or clippy is failing. Fix the issues, commit, and ensure the tree is clean." \
            >/dev/null || fix_rc=$?
          if [[ "$fix_rc" -eq 2 ]]; then
            flag_rate_limit
            gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
            cleanup_branch "$BRANCH_NAME"
            return 2
          fi
        fi
      fi
    fi
  done

  if [[ "$VERIFY_CLEAN_PASSED" != "true" ]]; then
    log "ERROR: Working tree still not clean for #$TASK_ISSUE after fix attempt. Marking as pend."
    mark_pend "$TASK_ISSUE" "working tree が修正後もcleanになりません"
    cleanup_branch "$BRANCH_NAME"
    interruptible_sleep "$SLEEP_SECONDS"
    return 1
  fi

  log "Pre-push verification passed: working tree is clean."
  return 0
}
