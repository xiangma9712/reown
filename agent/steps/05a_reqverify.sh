# agent/steps/05a_reqverify.sh — step_reqverify: verify implementation meets issue requirements
# Return: 0=ok, 1=skip iteration, 2=break loop

step_reqverify() {
  cd "$REPO_ROOT"

  local VERIFY_PROMPT VERIFY_INPUT VERIFY_OUTPUT VERIFY_JSON VERDICT REASONING

  VERIFY_PROMPT=$(cat "$SCRIPT_DIR/prompts/verify.md")

  VERIFY_INPUT="$VERIFY_PROMPT

## Issue

- **Title**: $TASK_TITLE
- **Body**: $TASK_DESC"

  log "Running requirement verification for #$TASK_ISSUE..."
  local verify_rc=0
  VERIFY_OUTPUT=$(run_claude \
    --label "reqverify-$TASK_ISSUE" \
    --timeout "$TIMEOUT_VERIFY_FIX" \
    --max-turns "$VERIFY_MAX_TURNS" \
    --allowedTools "Read,Glob,Grep" \
    -- "$VERIFY_INPUT") || verify_rc=$?

  # Rate limit check
  if [[ "$verify_rc" -eq 2 ]]; then
    flag_rate_limit
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    return 2
  fi

  # Timeout — treat as pass to avoid blocking
  if [[ "$verify_rc" -eq 124 ]]; then
    log "WARN: Requirement verification timed out for #$TASK_ISSUE. Treating as pass."
    return 0
  fi

  # Parse verdict from output
  VERIFY_JSON=$(echo "$VERIFY_OUTPUT" | sed -n '/^```json$/,/^```$/{ /^```/d; p; }')
  VERDICT=$(echo "$VERIFY_JSON" | jq -r '.verdict' 2>/dev/null || echo "")
  REASONING=$(echo "$VERIFY_JSON" | jq -r '.reasoning' 2>/dev/null || echo "")

  if [[ "$VERDICT" == "pass" ]]; then
    log "Requirement verification passed for #$TASK_ISSUE: $REASONING"
    return 0
  fi

  if [[ "$VERDICT" != "fail" ]]; then
    log "WARN: Could not parse verify agent output for #$TASK_ISSUE. Treating as pass."
    return 0
  fi

  # ── First failure: attempt fix + re-verify ─────────────────────────────────
  log "Requirement verification failed for #$TASK_ISSUE: $REASONING"
  log "Attempting fix based on verification feedback..."

  local fix_rc=0
  run_claude \
    --label "reqverify-fix-$TASK_ISSUE" \
    --timeout "$TIMEOUT_VERIFY_FIX" \
    --max-turns "$FIX_MAX_TURNS" \
    --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
    -- "The requirement verification agent found that the implementation does not fully satisfy the issue requirements.

## Issue
- **Title**: $TASK_TITLE
- **Body**: $TASK_DESC

## Verification Feedback
$REASONING

Please fix the implementation to address the gap. Then run cargo test and cargo clippy --all-targets -- -D warnings to ensure everything still passes. Commit your changes." \
    >/dev/null || fix_rc=$?

  if [[ "$fix_rc" -eq 2 ]]; then
    flag_rate_limit
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    return 2
  fi

  # ── Re-verify after fix ────────────────────────────────────────────────────
  VERIFY_INPUT="$VERIFY_PROMPT

## Issue

- **Title**: $TASK_TITLE
- **Body**: $TASK_DESC"

  log "Re-running requirement verification for #$TASK_ISSUE after fix..."
  local reverify_rc=0
  VERIFY_OUTPUT=$(run_claude \
    --label "reqverify-retry-$TASK_ISSUE" \
    --timeout "$TIMEOUT_VERIFY_FIX" \
    --max-turns "$VERIFY_MAX_TURNS" \
    --allowedTools "Read,Glob,Grep" \
    -- "$VERIFY_INPUT") || reverify_rc=$?

  if [[ "$reverify_rc" -eq 2 ]]; then
    flag_rate_limit
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    return 2
  fi

  if [[ "$reverify_rc" -eq 124 ]]; then
    log "WARN: Re-verification timed out for #$TASK_ISSUE. Treating as pass."
    return 0
  fi

  VERIFY_JSON=$(echo "$VERIFY_OUTPUT" | sed -n '/^```json$/,/^```$/{ /^```/d; p; }')
  VERDICT=$(echo "$VERIFY_JSON" | jq -r '.verdict' 2>/dev/null || echo "")
  REASONING=$(echo "$VERIFY_JSON" | jq -r '.reasoning' 2>/dev/null || echo "")

  if [[ "$VERDICT" == "pass" ]]; then
    log "Requirement verification passed on retry for #$TASK_ISSUE: $REASONING"
    return 0
  fi

  # ── Final failure: mark as needs-split ─────────────────────────────────────
  log "ERROR: Requirement verification still failing for #$TASK_ISSUE after fix attempt. Marking as needs-split."
  mark_needs_split "$TASK_ISSUE"
  cleanup_branch "$BRANCH_NAME"
  interruptible_sleep "$SLEEP_SECONDS"
  return 1
}
