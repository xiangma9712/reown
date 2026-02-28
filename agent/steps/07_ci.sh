# agent/steps/07_ci.sh — step_ci: CI polling + fix on failure
# Return: 0=ok, 1=skip iteration, 2=break loop

step_ci() {
  local CI_PASSED=false
  local attempt
  for attempt in $(seq 1 "$CI_MAX_ATTEMPTS"); do
    log "Waiting for CI checks (attempt $attempt/$CI_MAX_ATTEMPTS)..."

    # Wait before checking — CI needs time to be queued and started
    if [[ "$attempt" -eq 1 ]]; then
      log "Waiting ${CI_INITIAL_WAIT}s for CI to start..."
      interruptible_sleep "$CI_INITIAL_WAIT"
    else
      log "Waiting ${CI_INITIAL_WAIT}s for new CI run to start..."
      interruptible_sleep "$CI_INITIAL_WAIT"
    fi

    # Poll CI status until it reaches a terminal state (with timeout)
    local CI_DONE=false
    local CI_THIS_ATTEMPT=false
    local poll=0
    local poll_start
    poll_start=$(date +%s)
    while true; do
      poll=$((poll + 1))
      local elapsed=$(( $(date +%s) - poll_start ))
      if [[ "$elapsed" -ge "$CI_POLL_TIMEOUT" ]]; then
        log "WARN: CI polling timed out after ${elapsed}s (limit ${CI_POLL_TIMEOUT}s) on attempt $attempt."
        break
      fi

      local CI_STATUS
      CI_STATUS=$(gh pr checks "$PR_URL" 2>/dev/null) || true

      if [[ -z "$CI_STATUS" ]]; then
        log "No CI checks found yet (poll $poll, ${elapsed}s elapsed). Waiting..."
        interruptible_sleep "$CI_POLL_INTERVAL"
        continue
      fi

      # Check if any checks are still pending or in progress
      if echo "$CI_STATUS" | grep -qiE "pending|in_progress|queued|running"; then
        log "CI still running (poll $poll, ${elapsed}s elapsed)..."
        interruptible_sleep "$CI_POLL_INTERVAL"
        continue
      fi

      # All checks have reached a terminal state
      CI_DONE=true
      if echo "$CI_STATUS" | grep -qiE "fail|error"; then
        log "CI checks failed on attempt $attempt."
        CI_THIS_ATTEMPT=false
      else
        log "CI checks passed."
        CI_THIS_ATTEMPT=true
      fi
      break
    done

    if [[ "$CI_DONE" != "true" ]]; then
      log "WARN: CI checks did not complete within polling window on attempt $attempt."
    fi

    if [[ "$CI_THIS_ATTEMPT" == "true" ]]; then
      CI_PASSED=true
      break
    fi

    # Don't attempt fix on the last attempt
    if [[ "$attempt" -lt "$CI_MAX_ATTEMPTS" ]]; then
      log "CI failed on attempt $attempt. Attempting fix..."

      # Build detailed prompt for the CI fix agent
      local ci_fix_prompt
      ci_fix_prompt="CI checks failed for this PR on branch \`$BRANCH_NAME\`.

## Step 1: Read the CI logs

Run this command to get the failed CI logs:
\`\`\`
gh run view \$(gh run list --branch $BRANCH_NAME --limit 1 --json databaseId --jq '.[0].databaseId') --log-failed
\`\`\`

## Step 2: Fix the issues

Read the error messages carefully and fix the root cause in the source files.

## Step 3: Run formatters

After fixing, run the appropriate formatters:
- Rust files: \`cargo fmt --all\`
- Frontend files: \`cd frontend && npx prettier --write src/\`

## Step 4: Commit and push

You MUST commit and push your changes. This is critical — without this step the fix has no effect.

\`\`\`bash
git add -A
git commit -m \"fix: address CI failures for #$TASK_ISSUE\"
git push
\`\`\`

## Step 5: Verify

Run \`git status\` to confirm the working tree is clean and all changes have been pushed."

      local fix_rc=0
      run_claude \
        --label "ci-fix-$TASK_ISSUE-attempt$attempt" \
        --timeout "$TIMEOUT_VERIFY_FIX" \
        --max-turns "$FIX_MAX_TURNS" \
        --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
        -- "$ci_fix_prompt" \
        >/dev/null || fix_rc=$?
      if [[ "$fix_rc" -eq 2 ]]; then
        flag_rate_limit
        gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
        return 2
      fi

      # ── Ensure agent's changes are committed and pushed ──────────────────
      cd "$REPO_ROOT"
      if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
        log "WARN: CI fix agent left uncommitted changes. Committing..."
        git add -A
        if ! git commit -m "fix: address CI failures for #$TASK_ISSUE" 2>/dev/null; then
          # Pre-commit hook failed — run formatters and retry
          log "WARN: Commit failed (pre-commit hook). Re-running formatters..."
          cargo fmt --all 2>/dev/null || true
          if has_frontend_changes; then
            (cd "$REPO_ROOT/frontend" && npx prettier --write src/ 2>/dev/null) || true
            (cd "$REPO_ROOT/frontend" && npx eslint --fix src/ 2>/dev/null) || true
          fi
          git add -A
          git commit -m "fix: address CI failures for #$TASK_ISSUE" 2>/dev/null || true
        fi
      fi
      git push 2>/dev/null || true
    fi
  done

  if [[ "$CI_PASSED" != "true" ]]; then
    log "ERROR: CI failed after $CI_MAX_ATTEMPTS attempts for #$TASK_ISSUE. Closing PR and marking as pend."
    gh pr comment "$PR_URL" --body "CI failed after $CI_MAX_ATTEMPTS attempts. Closing PR and marking as pend." 2>/dev/null || true
    gh pr close "$PR_URL" 2>/dev/null || true
    git push origin --delete "$BRANCH_NAME" 2>/dev/null || true
    mark_pend "$TASK_ISSUE" "CIが${CI_MAX_ATTEMPTS}回の修正試行後も失敗しています"
    cleanup_branch "$BRANCH_NAME"
    interruptible_sleep "$SLEEP_SECONDS"
    return 1
  fi

  return 0
}
