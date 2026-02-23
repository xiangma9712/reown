# agent/steps/01_setup.sh — step_setup: sync main + fetch issues
# Return: 0=ok, 1=skip iteration, 2=break loop

step_setup() {
  ensure_clean_main

  ISSUES_FILE="/tmp/claude/agent-issues.json"
  mkdir -p /tmp/claude
  if gh issue list --label "$AGENT_LABEL" --state open --json number,title,body,labels \
       --limit 50 > "$ISSUES_FILE" 2>/dev/null; then
    local issue_count
    issue_count=$(jq length "$ISSUES_FILE")
    log "Fetched $issue_count open issues with label '$AGENT_LABEL'"
  else
    log "ERROR: Failed to fetch GitHub issues. Cannot proceed without issue source."
    sleep "$SLEEP_SECONDS"
    return 1
  fi

  if [[ "$(jq length "$ISSUES_FILE")" -eq 0 ]]; then
    log "No open issues with label '$AGENT_LABEL'. Proposing new issues from INTENT.md gap analysis..."
    if ! propose_issues; then return 2; fi
    if is_rate_limited; then return 2; fi
    sleep "$SLEEP_SECONDS"
    return 1
  fi

  return 0
}
