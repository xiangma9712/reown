# agent/lib/40_github.sh — GitHub API helpers + propose_issues()

# Check if a label exists on the repo, create it if not
ensure_label_exists() {
  local label_name="$1"
  local label_color="${2:-ededed}"
  local label_desc="${3:-}"
  if ! gh label list --json name -q ".[].name" 2>/dev/null | grep -qx "$label_name"; then
    gh label create "$label_name" --color "$label_color" --description "$label_desc" 2>/dev/null || true
  fi
}

ensure_labels() {
  ensure_label_exists "planned"     "0e8a16" "Triaged and ready for implementation"
  ensure_label_exists "doing"       "fbca04" "Currently being worked on"
  ensure_label_exists "done"        "5319e7" "Completed"
  ensure_label_exists "needs-split" "d93f0b" "Too large, needs breakdown"
  ensure_label_exists "pend"        "c5def5" "Blocked, needs human review or retry"
}

# Mark an issue as needing split via label
mark_needs_split() {
  local issue_num="$1"
  if gh issue edit "$issue_num" --add-label "needs-split" --remove-label "doing" 2>/dev/null; then
    log "Marked issue #$issue_num as needs-split"
  else
    log "WARN: Failed to mark issue #$issue_num as needs-split"
  fi
}

# Mark an issue as pending (blocked, not a scope issue) via label
mark_pend() {
  local issue_num="$1"
  local reason="${2:-}"
  if gh issue edit "$issue_num" --add-label "pend" --remove-label "doing" 2>/dev/null; then
    log "Marked issue #$issue_num as pend"
  else
    log "WARN: Failed to mark issue #$issue_num as pend"
  fi
  if [[ -n "$reason" ]]; then
    gh issue comment "$issue_num" --body "## Pend

このissueは一時的にブロックされています。

**理由**: $reason

---
_Automatically posted by agent/loop.sh_" 2>/dev/null || true
  fi
}

# Propose new issues by analyzing the gap between INTENT.md and the codebase.
# Called when the agent has no issues to work on.
propose_issues() {
  cd "$REPO_ROOT"

  # Gather all open issues (not just agent-labeled) to avoid duplicates
  ALL_ISSUES=$(gh issue list --state open --json number,title,labels --limit 100 2>/dev/null || echo "[]")

  PROPOSE_PROMPT=$(cat "$SCRIPT_DIR/prompts/propose.md")
  INTENT_CONTENT=$(cat "$REPO_ROOT/docs/INTENT.md" 2>/dev/null || echo "(INTENT.md not found)")
  README_CONTENT=$(cat "$REPO_ROOT/README.md" 2>/dev/null || echo "(README.md not found)")
  SRC_FILES=$(find "$REPO_ROOT/src" -name '*.rs' -type f 2>/dev/null | sed "s|$REPO_ROOT/||" | sort)

  PROPOSE_INPUT="$PROPOSE_PROMPT

## docs/INTENT.md (Product Vision)
$INTENT_CONTENT

## README.md (Current Features & Roadmap)
$README_CONTENT

## Existing Open GitHub Issues (avoid duplicates)
\`\`\`json
$ALL_ISSUES
\`\`\`

## Source Files (what's currently implemented)
\`\`\`
$SRC_FILES
\`\`\`"

  log "Running propose agent to identify unrealized features..."
  PROPOSE_STDERR="/tmp/claude/agent-propose-stderr.log"
  PROPOSE_OUTPUT=$(claude -p "$PROPOSE_INPUT" \
    --max-turns "$PROPOSE_MAX_TURNS" \
    --max-budget-usd "$MAX_BUDGET_USD" \
    2>"$PROPOSE_STDERR") || true

  if check_rate_limit "$PROPOSE_STDERR"; then
    flag_rate_limit
    return 1
  fi

  PROPOSE_JSON=$(echo "$PROPOSE_OUTPUT" | sed -n '/^```json$/,/^```$/{ /^```/d; p; }')

  if echo "$PROPOSE_JSON" | jq empty 2>/dev/null; then
    PROPOSED_COUNT=$(echo "$PROPOSE_JSON" | jq length)
    echo "$PROPOSE_JSON" | jq -c '.[]' 2>/dev/null | while IFS= read -r entry; do
      P_TITLE=$(echo "$entry" | jq -r '.title')
      P_BODY=$(echo "$entry" | jq -r '.body')
      P_LABELS=$(echo "$entry" | jq -r '.labels // ["agent"] | join(",")')

      if gh issue create --title "$P_TITLE" --body "$P_BODY" --label "$P_LABELS" 2>/dev/null; then
        log "Proposed new issue: $P_TITLE"
      else
        log "WARN: Failed to create proposed issue: $P_TITLE"
      fi
    done
    log "Propose agent created $PROPOSED_COUNT new issue(s)"
  else
    log "WARN: Propose agent output invalid JSON. Skipping."
  fi

  return 0
}
