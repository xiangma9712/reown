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
      sleep "$CI_INITIAL_WAIT"
    else
      log "Waiting ${CI_INITIAL_WAIT}s for new CI run to start..."
      sleep "$CI_INITIAL_WAIT"
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
        sleep "$CI_POLL_INTERVAL"
        continue
      fi

      # Check if any checks are still pending or in progress
      if echo "$CI_STATUS" | grep -qiE "pending|in_progress|queued|running"; then
        log "CI still running (poll $poll, ${elapsed}s elapsed)..."
        sleep "$CI_POLL_INTERVAL"
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
      local FIX_STDERR="/tmp/claude/agent-fix-stderr.log"
      claude -p "CI checks failed for this PR. Read the CI logs, fix the issues, commit, and push." \
        --max-turns "$FIX_MAX_TURNS" \
        --max-budget-usd "$MAX_BUDGET_USD" \
        --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
        2>"$FIX_STDERR" || true
      if check_rate_limit "$FIX_STDERR"; then
        flag_rate_limit
        gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
        return 2
      fi
      cd "$REPO_ROOT"
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
    sleep "$SLEEP_SECONDS"
    return 1
  fi

  return 0
}
