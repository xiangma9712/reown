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
    sleep "$SLEEP_SECONDS"
    return 1
  fi

  git checkout -b "$BRANCH_NAME"

  local IMPLEMENT_PROMPT IMPLEMENT_INPUT CLAUDE_STDERR CLAUDE_EXIT
  IMPLEMENT_PROMPT=$(cat "$SCRIPT_DIR/prompts/implement.md")
  IMPLEMENT_INPUT="$IMPLEMENT_PROMPT

## Task to Implement

- **ID**: $TASK_ID
- **Issue**: #$TASK_ISSUE
- **Title**: $TASK_TITLE
- **Description**: $TASK_DESC"

  log "Running implementation agent for #$TASK_ISSUE..."
  CLAUDE_STDERR="/tmp/claude/agent-implement-stderr.log"
  claude -p "$IMPLEMENT_INPUT" \
       --max-turns "$IMPLEMENT_MAX_TURNS" \
       --max-budget-usd "$MAX_BUDGET_USD" \
       --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
       2>"$CLAUDE_STDERR"
  CLAUDE_EXIT=$?

  # Rate limit check — stop the entire loop
  if check_rate_limit "$CLAUDE_STDERR"; then
    flag_rate_limit
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    return 2
  fi

  if [[ $CLAUDE_EXIT -ne 0 ]] || grep -qi "max turns\|max budget" "$CLAUDE_STDERR" 2>/dev/null; then
    if grep -qi "max turns\|max budget" "$CLAUDE_STDERR" 2>/dev/null; then
      log "ERROR: Implementation agent hit resource limit for #$TASK_ISSUE. Needs split."
    else
      log "ERROR: Implementation agent failed for #$TASK_ISSUE (exit=$CLAUDE_EXIT)"
    fi
    mark_needs_split "$TASK_ISSUE"
    cleanup_branch "$BRANCH_NAME"
    sleep "$SLEEP_SECONDS"
    return 1
  fi

  return 0
}
