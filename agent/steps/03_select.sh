# agent/steps/03_select.sh — step_select: pick next planned issue
# Return: 0=ok, 1=skip iteration, 2=break loop

step_select() {
  # Pick the oldest issue with 'agent' + 'planned' labels, but NOT 'doing', 'done', 'needs-split'
  local TASK_ISSUE_JSON
  TASK_ISSUE_JSON=$(jq 'map(select(
    (.labels | map(.name) | index("planned")) != null and
    (.labels | map(.name) | index("doing")) == null and
    (.labels | map(.name) | index("done")) == null and
    (.labels | map(.name) | index("needs-split")) == null
  )) | sort_by(.number) | first // empty' "$ISSUES_FILE")

  if [[ -z "$TASK_ISSUE_JSON" || "$TASK_ISSUE_JSON" == "null" ]]; then
    log "No planned tasks available. Proposing new issues from INTENT.md gap analysis..."
    if ! propose_issues; then return 2; fi
    if is_rate_limited; then return 2; fi
    sleep "$SLEEP_SECONDS"
    return 1
  fi

  TASK_ISSUE=$(echo "$TASK_ISSUE_JSON" | jq -r '.number')
  TASK_TITLE=$(echo "$TASK_ISSUE_JSON" | jq -r '.title')
  TASK_DESC=$(echo "$TASK_ISSUE_JSON" | jq -r '.body // ""')
  TASK_ID="issue-${TASK_ISSUE}"

  log "Selected task: #$TASK_ISSUE — $TASK_TITLE"

  if should_stop; then
    log "Stop requested before implementation. Exiting gracefully."
    rm -f "$STOP_FILE"
    return 2
  fi

  return 0
}
