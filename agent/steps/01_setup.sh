# agent/steps/01_setup.sh — step_setup: sync main + fetch issues
# Return: 0=ok, 1=skip iteration, 2=break loop

step_setup() {
  ensure_clean_main

  ISSUES_FILE="/tmp/claude/agent-issues.json"
  local RAW_ISSUES_FILE="/tmp/claude/agent-issues-raw.json"
  mkdir -p /tmp/claude
  if gh issue list --label "$AGENT_LABEL" --state open --json number,title,body,labels,author \
       --limit 50 > "$RAW_ISSUES_FILE" 2>/dev/null; then
    # Filter issues to only include those from the allowed author
    jq --arg author "$ALLOWED_ISSUE_AUTHOR" \
      '[.[] | select(.author.login == $author)]' "$RAW_ISSUES_FILE" > "$ISSUES_FILE"
    local issue_count raw_count
    raw_count=$(jq length "$RAW_ISSUES_FILE")
    issue_count=$(jq length "$ISSUES_FILE")
    log "Fetched $raw_count open issues with label '$AGENT_LABEL' ($issue_count from allowed author '$ALLOWED_ISSUE_AUTHOR')"
  else
    log "ERROR: Failed to fetch GitHub issues. Cannot proceed without issue source."
    interruptible_sleep "$SLEEP_SECONDS"
    return 1
  fi

  if [[ "$(jq length "$ISSUES_FILE")" -eq 0 ]]; then
    log "No open issues with label '$AGENT_LABEL'. Proposing new issues from INTENT.md gap analysis..."
    if ! propose_issues; then return 2; fi
    if is_rate_limited; then return 2; fi
    _skip_is_benign=true
    interruptible_sleep "$SLEEP_SECONDS"
    return 1
  fi

  return 0
}
