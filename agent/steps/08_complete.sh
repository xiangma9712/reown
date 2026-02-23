# agent/steps/08_complete.sh — step_complete: merge + done + cleanup
# Return: 0=ok, 1=skip iteration, 2=break loop

step_complete() {
  log "CI passed. Merging PR..."
  if gh pr merge "$PR_URL" --squash --delete-branch 2>/dev/null; then
    log "PR merged: $PR_URL"
  else
    log "ERROR: Failed to merge PR. Leaving for manual review."
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    sleep "$SLEEP_SECONDS"
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
