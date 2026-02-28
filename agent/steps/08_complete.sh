# agent/steps/08_complete.sh — step_complete: merge + done + cleanup
# Return: 0=ok, 1=skip iteration, 2=break loop

step_complete() {
  log "CI passed. Merging PR..."

  # Squash merge without --delete-branch to avoid false failures when
  # GitHub's auto-delete is enabled (the flag races with auto-delete).
  # Branch cleanup is handled separately below.
  local merge_ok=false
  if gh pr merge "$PR_URL" --squash 2>/dev/null; then
    merge_ok=true
    log "PR merged: $PR_URL"
  fi

  if [[ "$merge_ok" != "true" ]]; then
    log "ERROR: Failed to merge PR. Leaving for manual review."
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    interruptible_sleep "$SLEEP_SECONDS"
    return 1
  fi

  # Delete remote branch separately (best-effort; may already be gone
  # if the repo has auto-delete enabled).
  git push origin --delete "$BRANCH_NAME" 2>/dev/null || true

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
