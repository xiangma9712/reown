# agent/steps/05b_review.sh — step_review: code review quality check before push
# Return: 0=ok, 1=skip iteration, 2=break loop

step_review() {
  cd "$REPO_ROOT"

  local REVIEW_PROMPT CLAUDE_MD DIFF_OUTPUT REVIEW_INPUT REVIEW_OUTPUT REVIEW_JSON VERDICT REASONING

  REVIEW_PROMPT=$(cat "$SCRIPT_DIR/prompts/review.md")
  CLAUDE_MD=$(cat "$REPO_ROOT/CLAUDE.md" 2>/dev/null || echo "(CLAUDE.md not found)")
  DIFF_OUTPUT=$(git diff main...HEAD 2>/dev/null || git diff main 2>/dev/null || echo "(no diff available)")

  REVIEW_INPUT="$REVIEW_PROMPT

## CLAUDE.md (Project Patterns)

$CLAUDE_MD

## Git Diff (main...HEAD)

\`\`\`diff
$DIFF_OUTPUT
\`\`\`"

  log "Running code review for #$TASK_ISSUE..."
  local review_rc=0
  REVIEW_OUTPUT=$(run_claude \
    --label "review-$TASK_ISSUE" \
    --timeout "$TIMEOUT_VERIFY_FIX" \
    --max-turns "$REVIEW_MAX_TURNS" \
    -- "$REVIEW_INPUT") || review_rc=$?

  # Rate limit check
  if [[ "$review_rc" -eq 2 ]]; then
    flag_rate_limit
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    return 2
  fi

  # Timeout — treat as pass to avoid blocking
  if [[ "$review_rc" -eq 124 ]]; then
    log "WARN: Code review timed out for #$TASK_ISSUE. Treating as pass."
    return 0
  fi

  # Parse verdict from output
  REVIEW_JSON=$(echo "$REVIEW_OUTPUT" | sed -n '/^```json$/,/^```$/{ /^```/d; p; }')
  VERDICT=$(echo "$REVIEW_JSON" | jq -r '.verdict' 2>/dev/null || echo "")
  REASONING=$(echo "$REVIEW_JSON" | jq -r '.reasoning' 2>/dev/null || echo "")

  if [[ "$VERDICT" == "pass" ]]; then
    log "Code review passed for #$TASK_ISSUE: $REASONING"
    return 0
  fi

  if [[ "$VERDICT" != "fail" ]]; then
    log "WARN: Could not parse review agent output for #$TASK_ISSUE. Treating as pass."
    return 0
  fi

  # ── First failure: attempt fix + re-review ─────────────────────────────────
  local ISSUES
  ISSUES=$(echo "$REVIEW_JSON" | jq -r '.issues // [] | join("\n")' 2>/dev/null || echo "$REASONING")

  log "Code review failed for #$TASK_ISSUE: $REASONING"
  log "Attempting fix based on review feedback..."

  local fix_rc=0
  run_claude \
    --label "review-fix-$TASK_ISSUE" \
    --timeout "$TIMEOUT_VERIFY_FIX" \
    --max-turns "$FIX_MAX_TURNS" \
    --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
    -- "The code review agent found quality issues in the implementation.

## Review Issues
$ISSUES

## Review Summary
$REASONING

Please fix the issues identified by the review. Then run cargo test and cargo clippy --all-targets -- -D warnings to ensure everything still passes. Commit your changes." \
    >/dev/null || fix_rc=$?

  if [[ "$fix_rc" -eq 2 ]]; then
    flag_rate_limit
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    return 2
  fi

  # ── Re-review after fix ────────────────────────────────────────────────────
  DIFF_OUTPUT=$(git diff main...HEAD 2>/dev/null || git diff main 2>/dev/null || echo "(no diff available)")
  REVIEW_INPUT="$REVIEW_PROMPT

## CLAUDE.md (Project Patterns)

$CLAUDE_MD

## Git Diff (main...HEAD)

\`\`\`diff
$DIFF_OUTPUT
\`\`\`"

  log "Re-running code review for #$TASK_ISSUE after fix..."
  local rereview_rc=0
  REVIEW_OUTPUT=$(run_claude \
    --label "review-retry-$TASK_ISSUE" \
    --timeout "$TIMEOUT_VERIFY_FIX" \
    --max-turns "$REVIEW_MAX_TURNS" \
    -- "$REVIEW_INPUT") || rereview_rc=$?

  if [[ "$rereview_rc" -eq 2 ]]; then
    flag_rate_limit
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    return 2
  fi

  if [[ "$rereview_rc" -eq 124 ]]; then
    log "WARN: Re-review timed out for #$TASK_ISSUE. Treating as pass."
    return 0
  fi

  REVIEW_JSON=$(echo "$REVIEW_OUTPUT" | sed -n '/^```json$/,/^```$/{ /^```/d; p; }')
  VERDICT=$(echo "$REVIEW_JSON" | jq -r '.verdict' 2>/dev/null || echo "")
  REASONING=$(echo "$REVIEW_JSON" | jq -r '.reasoning' 2>/dev/null || echo "")

  if [[ "$VERDICT" == "pass" ]]; then
    log "Code review passed on retry for #$TASK_ISSUE: $REASONING"
    return 0
  fi

  # ── Final failure: mark as needs-split ─────────────────────────────────────
  log "ERROR: Code review still failing for #$TASK_ISSUE after fix attempt. Marking as needs-split."
  mark_needs_split "$TASK_ISSUE"
  cleanup_branch "$BRANCH_NAME"
  interruptible_sleep "$SLEEP_SECONDS"
  return 1
}
