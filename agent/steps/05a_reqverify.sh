# agent/steps/05a_reqverify.sh — step_reqverify: verify implementation meets issue requirements
# Return: 0=ok, 1=skip iteration, 2=break loop

step_reqverify() {
  cd "$REPO_ROOT"

  local VERIFY_PROMPT DIFF_OUTPUT VERIFY_INPUT VERIFY_STDERR VERIFY_OUTPUT VERIFY_JSON VERDICT REASONING

  VERIFY_PROMPT=$(cat "$SCRIPT_DIR/prompts/verify.md")
  DIFF_OUTPUT=$(git diff main...HEAD 2>/dev/null || git diff main 2>/dev/null || echo "(no diff available)")

  VERIFY_INPUT="$VERIFY_PROMPT

## Issue

- **Title**: $TASK_TITLE
- **Body**: $TASK_DESC

## Git Diff (main...HEAD)

\`\`\`diff
$DIFF_OUTPUT
\`\`\`"

  log "Running requirement verification for #$TASK_ISSUE..."
  VERIFY_STDERR="/tmp/claude/agent-reqverify-stderr.log"
  VERIFY_OUTPUT=$(claude -p "$VERIFY_INPUT" \
    --max-turns "$VERIFY_MAX_TURNS" \
    --max-budget-usd "$MAX_BUDGET_USD" \
    2>"$VERIFY_STDERR") || true

  # Rate limit check
  if check_rate_limit "$VERIFY_STDERR"; then
    flag_rate_limit
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    return 2
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

  local FIX_STDERR="/tmp/claude/agent-reqverify-fix-stderr.log"
  claude -p "The requirement verification agent found that the implementation does not fully satisfy the issue requirements.

## Issue
- **Title**: $TASK_TITLE
- **Body**: $TASK_DESC

## Verification Feedback
$REASONING

Please fix the implementation to address the gap. Then run cargo test and cargo clippy --all-targets -- -D warnings to ensure everything still passes. Commit your changes." \
    --max-turns "$FIX_MAX_TURNS" \
    --max-budget-usd "$MAX_BUDGET_USD" \
    --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
    2>"$FIX_STDERR" || true

  if check_rate_limit "$FIX_STDERR"; then
    flag_rate_limit
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    return 2
  fi

  # ── Re-verify after fix ────────────────────────────────────────────────────
  DIFF_OUTPUT=$(git diff main...HEAD 2>/dev/null || git diff main 2>/dev/null || echo "(no diff available)")
  VERIFY_INPUT="$VERIFY_PROMPT

## Issue

- **Title**: $TASK_TITLE
- **Body**: $TASK_DESC

## Git Diff (main...HEAD)

\`\`\`diff
$DIFF_OUTPUT
\`\`\`"

  log "Re-running requirement verification for #$TASK_ISSUE after fix..."
  VERIFY_STDERR="/tmp/claude/agent-reqverify-retry-stderr.log"
  VERIFY_OUTPUT=$(claude -p "$VERIFY_INPUT" \
    --max-turns "$VERIFY_MAX_TURNS" \
    --max-budget-usd "$MAX_BUDGET_USD" \
    2>"$VERIFY_STDERR") || true

  if check_rate_limit "$VERIFY_STDERR"; then
    flag_rate_limit
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    return 2
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
  sleep "$SLEEP_SECONDS"
  return 1
}
