# agent/steps/03_select.sh — step_select: pick next planned issue
# Return: 0=ok, 1=skip iteration, 2=break loop

step_select() {
  # Pick the highest-priority planned issue (priority-high > priority-middle > priority-low > unlabeled)
  # Within the same priority, pick the oldest (lowest issue number)
  local TASK_ISSUE_JSON
  TASK_ISSUE_JSON=$(jq 'map(select(
    (.labels | map(.name) | index("planned")) != null and
    (.labels | map(.name) | index("doing")) == null and
    (.labels | map(.name) | index("done")) == null and
    (.labels | map(.name) | index("needs-split")) == null and
    (.labels | map(.name) | index("pend")) == null
  )) | map(. + {
    _priority_order: (
      if (.labels | map(.name) | index("priority-high")) != null then 0
      elif (.labels | map(.name) | index("priority-middle")) != null then 1
      elif (.labels | map(.name) | index("priority-low")) != null then 2
      else 3
      end
    )
  }) | sort_by([._priority_order, .number]) | first // empty | del(._priority_order)' "$ISSUES_FILE")

  if [[ -z "$TASK_ISSUE_JSON" || "$TASK_ISSUE_JSON" == "null" ]]; then
    log "No planned tasks available. Proposing new issues from INTENT.md gap analysis..."
    if ! propose_issues; then return 2; fi
    if is_rate_limited; then return 2; fi
    _skip_is_benign=true
    interruptible_sleep "$SLEEP_SECONDS"
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
