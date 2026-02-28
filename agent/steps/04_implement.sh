# agent/steps/04_implement.sh — step_implement: branch + run implementation agent
# Return: 0=ok, 1=skip iteration, 2=break loop

step_implement() {
  # Mark issue as 'doing'
  if ! gh issue edit "$TASK_ISSUE" --add-label "doing" 2>/dev/null; then
    log "WARN: Failed to apply 'doing' label to issue #$TASK_ISSUE"
  fi

  BRANCH_NAME="agent/$TASK_ID"
  cd "$REPO_ROOT"

  # Guard: verify main is up-to-date with origin before branching
  if ! verify_main_is_latest; then
    log "ERROR: Cannot verify main is latest for #$TASK_ISSUE. Skipping iteration."
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    interruptible_sleep "$SLEEP_SECONDS"
    return 1
  fi

  git checkout -b "$BRANCH_NAME"

  # ── Pre-check: verify if requirements are already met ────────────────────
  local PRECHECK_PROMPT PRECHECK_INPUT PRECHECK_OUTPUT PRECHECK_JSON PRECHECK_VERDICT

  PRECHECK_PROMPT=$(cat "$SCRIPT_DIR/prompts/verify.md")
  PRECHECK_INPUT="$PRECHECK_PROMPT

## Issue

- **Title**: $TASK_TITLE
- **Body**: $TASK_DESC"

  log "Running pre-implementation verification for #$TASK_ISSUE..."
  local precheck_rc=0
  PRECHECK_OUTPUT=$(run_claude \
    --label "precheck-$TASK_ISSUE" \
    --timeout "$TIMEOUT_VERIFY_FIX" \
    --max-turns "$VERIFY_MAX_TURNS" \
    --allowedTools "Read,Glob,Grep" \
    -- "$PRECHECK_INPUT") || precheck_rc=$?

  if [[ "$precheck_rc" -eq 2 ]]; then
    flag_rate_limit
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    return 2
  fi

  # Timeout or error on pre-check → proceed with implementation (non-fatal)
  if [[ "$precheck_rc" -eq 0 ]]; then
    PRECHECK_JSON=$(echo "$PRECHECK_OUTPUT" | sed -n '/^```json$/,/^```$/{ /^```/d; p; }')
    PRECHECK_VERDICT=$(echo "$PRECHECK_JSON" | jq -r '.verdict' 2>/dev/null || echo "")

    if [[ "$PRECHECK_VERDICT" == "pass" ]]; then
      local PRECHECK_REASONING
      PRECHECK_REASONING=$(echo "$PRECHECK_JSON" | jq -r '.reasoning' 2>/dev/null || echo "")
      log "Pre-check passed: requirements already met for #$TASK_ISSUE. Skipping implementation."
      gh issue edit "$TASK_ISSUE" --add-label "done" --remove-label "doing" --remove-label "planned" 2>/dev/null || true
      gh issue comment "$TASK_ISSUE" \
        --body "このissueの機能は既にmainに実装済みです。エージェントが確認しクローズしました。

**検証結果**: $PRECHECK_REASONING

---
_Automatically posted by agent/loop.sh_" 2>/dev/null || true
      gh issue close "$TASK_ISSUE" 2>/dev/null || true
      log "Issue #$TASK_ISSUE closed as already implemented (pre-check)."
      cleanup_branch "$BRANCH_NAME"
      interruptible_sleep "$SLEEP_SECONDS"
      return 1
    fi
  fi

  log "Pre-check: requirements not yet met for #$TASK_ISSUE. Proceeding with implementation."

  # ── Run implementation agent ─────────────────────────────────────────────
  local IMPLEMENT_PROMPT IMPLEMENT_INPUT
  IMPLEMENT_PROMPT=$(cat "$SCRIPT_DIR/prompts/implement.md")
  IMPLEMENT_INPUT="$IMPLEMENT_PROMPT

## Task to Implement

- **ID**: $TASK_ID
- **Issue**: #$TASK_ISSUE
- **Title**: $TASK_TITLE
- **Description**: $TASK_DESC"

  log "Running implementation agent for #$TASK_ISSUE..."
  local impl_rc=0
  run_claude \
    --label "implement-$TASK_ISSUE" \
    --timeout "$TIMEOUT_IMPLEMENT" \
    --max-turns "$IMPLEMENT_MAX_TURNS" \
    --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
    -- "$IMPLEMENT_INPUT" >/dev/null || impl_rc=$?

  if [[ "$impl_rc" -eq 2 ]]; then
    flag_rate_limit
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    return 2
  fi

  if [[ "$impl_rc" -eq 124 ]]; then
    log "ERROR: Implementation agent timed out for #$TASK_ISSUE. Marking as pend."
    mark_pend "$TASK_ISSUE" "実装エージェントがタイムアウトしました（再試行可能）"
    cleanup_branch "$BRANCH_NAME"
    interruptible_sleep "$SLEEP_SECONDS"
    return 1
  fi

  local impl_stderr
  impl_stderr=$(run_claude_stderr "implement-$TASK_ISSUE")
  if [[ "$impl_rc" -ne 0 ]] || grep -qi "max turns\|max budget" "$impl_stderr" 2>/dev/null; then
    if grep -qi "max turns\|max budget" "$impl_stderr" 2>/dev/null; then
      log "ERROR: Implementation agent hit resource limit for #$TASK_ISSUE. Marking as pend."
    else
      log "ERROR: Implementation agent failed for #$TASK_ISSUE (exit=$impl_rc)"
    fi
    mark_pend "$TASK_ISSUE" "実装エージェントが失敗しました（再試行可能）"
    cleanup_branch "$BRANCH_NAME"
    interruptible_sleep "$SLEEP_SECONDS"
    return 1
  fi

  # ── Check if any changes were actually made ──────────────────────────────
  cd "$REPO_ROOT"
  local DIFF_FROM_MAIN
  DIFF_FROM_MAIN=$(git diff main --name-only 2>/dev/null)
  local UNTRACKED
  UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null)

  if [[ -z "$DIFF_FROM_MAIN" && -z "$UNTRACKED" ]]; then
    log "No changes made by implementation agent for #$TASK_ISSUE. Issue is already implemented."
    gh issue edit "$TASK_ISSUE" --add-label "done" --remove-label "doing" --remove-label "planned" 2>/dev/null || true
    gh issue comment "$TASK_ISSUE" \
      --body "このissueの機能は既にmainに実装済みです。エージェントが確認しクローズしました。

---
_Automatically posted by agent/loop.sh_" 2>/dev/null || true
    gh issue close "$TASK_ISSUE" 2>/dev/null || true
    log "Issue #$TASK_ISSUE closed as already implemented."
    cleanup_branch "$BRANCH_NAME"
    interruptible_sleep "$SLEEP_SECONDS"
    return 1
  fi

  return 0
}
