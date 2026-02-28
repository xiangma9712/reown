# agent/steps/08_complete.sh — step_complete: merge + done + cleanup
# Return: 0=ok, 1=skip iteration, 2=break loop

step_complete() {
  log "CI passed. Merging PR..."

  # Attempt squash merge. Separate merge and branch delete to avoid false
  # failures when auto-delete is enabled on the repo (--delete-branch can
  # fail if the branch was already removed by GitHub).
  local merge_ok=false
  if gh pr merge "$PR_URL" --squash --delete-branch 2>/dev/null; then
    merge_ok=true
    log "PR merged: $PR_URL"
  else
    # gh pr merge can exit non-zero even when the merge succeeded (e.g.
    # branch auto-delete race). Check the actual PR state before giving up.
    local pr_state
    pr_state=$(gh pr view "$PR_URL" --json state -q '.state' 2>/dev/null || echo "")
    if [[ "$pr_state" == "MERGED" ]]; then
      merge_ok=true
      log "PR merged (confirmed via API): $PR_URL"
    fi
  fi

  if [[ "$merge_ok" != "true" ]]; then
    log "ERROR: Failed to merge PR. Leaving for manual review."
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    interruptible_sleep "$SLEEP_SECONDS"
    return 1
  fi

  # Mark issue as done & close
  gh issue edit "$TASK_ISSUE" --add-label "done" --remove-label "doing" --remove-label "planned" 2>/dev/null || true
  gh issue comment "$TASK_ISSUE" \
    --body "Implemented in $PR_URL by agent/loop.sh" 2>/dev/null || true
  gh issue close "$TASK_ISSUE" 2>/dev/null || true
  log "Issue #$TASK_ISSUE marked as done and closed"

  # Return to main
  cd "$REPO_ROOT"
  git checkout main
  git pull --ff-only origin main 2>/dev/null || true

  log "Task #$TASK_ISSUE completed successfully."
  return 0
}
