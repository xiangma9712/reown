# agent/steps/02_triage.sh — step_triage: triage new issues + split large ones
# Return: 0=ok, 1=skip iteration, 2=break loop

step_triage() {
  # ── Triage new issues ──────────────────────────────────────────────────────
  # Find issues that have 'agent' label but NOT 'planned', 'doing', 'done', or 'needs-split'
  local NEW_ISSUES
  NEW_ISSUES=$(jq '[.[] | select(
    (.labels | map(.name) | index("planned")) == null and
    (.labels | map(.name) | index("doing")) == null and
    (.labels | map(.name) | index("done")) == null and
    (.labels | map(.name) | index("needs-split")) == null
  )]' "$ISSUES_FILE")

  local NEW_ISSUE_COUNT
  NEW_ISSUE_COUNT=$(echo "$NEW_ISSUES" | jq length)
  if [[ "$NEW_ISSUE_COUNT" -gt 0 ]]; then
    log "Found $NEW_ISSUE_COUNT new issues to triage..."

    # Run roadmap agent to triage new issues
    local ROADMAP_PROMPT INTENT_CONTENT ROADMAP_INPUT
    ROADMAP_PROMPT=$(cat "$SCRIPT_DIR/prompts/roadmap.md")
    INTENT_CONTENT=$(cat "$REPO_ROOT/docs/INTENT.md" 2>/dev/null || echo "(INTENT.md not found)")

    ROADMAP_INPUT="$ROADMAP_PROMPT

## docs/INTENT.md (Product Vision)
$INTENT_CONTENT

## New GitHub Issues to triage (JSON)
\`\`\`json
$NEW_ISSUES
\`\`\`"

    log "Running roadmap agent to triage $NEW_ISSUE_COUNT new issues..."
    local ROADMAP_STDERR="/tmp/claude/agent-roadmap-stderr.log"
    local ROADMAP_OUTPUT
    ROADMAP_OUTPUT=$(claude -p "$ROADMAP_INPUT" \
      --max-turns "$ROADMAP_MAX_TURNS" \
      --max-budget-usd "$MAX_BUDGET_USD" \
      2>"$ROADMAP_STDERR") || true
    if check_rate_limit "$ROADMAP_STDERR"; then flag_rate_limit; return 2; fi

    # Extract JSON from output (between ```json and ```)
    local TRIAGE_JSON
    TRIAGE_JSON=$(echo "$ROADMAP_OUTPUT" | sed -n '/^```json$/,/^```$/{ /^```/d; p; }')

    if echo "$TRIAGE_JSON" | jq empty 2>/dev/null; then
      # Apply 'planned' label and post triage comment for each issue
      echo "$TRIAGE_JSON" | jq -c '.[]' 2>/dev/null | while IFS= read -r entry; do
        local ISSUE_NUM T_PILLAR T_APPROACH T_PRIORITY T_NEEDS_SPLIT TRIAGE_LABEL TRIAGE_STATUS
        ISSUE_NUM=$(echo "$entry" | jq -r '.issue')
        T_PILLAR=$(echo "$entry" | jq -r '.pillar // "N/A"')
        T_APPROACH=$(echo "$entry" | jq -r '.approach // .description // "N/A"')
        T_PRIORITY=$(echo "$entry" | jq -r '.priority // "N/A"')
        T_NEEDS_SPLIT=$(echo "$entry" | jq -r '.needs_split // false')

        # Apply label based on triage result
        if [[ "$T_NEEDS_SPLIT" == "true" ]]; then
          TRIAGE_LABEL="needs-split"
          TRIAGE_STATUS="Needs Split"
        else
          TRIAGE_LABEL="planned"
          TRIAGE_STATUS="Planned"
        fi

        if gh issue edit "$ISSUE_NUM" --add-label "$TRIAGE_LABEL" 2>/dev/null; then
          log "Applied '$TRIAGE_LABEL' label to issue #$ISSUE_NUM"
        else
          log "WARN: Failed to apply '$TRIAGE_LABEL' label to issue #$ISSUE_NUM"
        fi

        # Post triage comment
        local COMMENT_BODY
        COMMENT_BODY="## $TRIAGE_STATUS

| Field | Value |
|-------|-------|
| **Priority** | $T_PRIORITY |
| **Pillar** | $T_PILLAR |
| **Status** | $TRIAGE_STATUS |

### Approach

$T_APPROACH

---
_Automatically posted by agent/loop.sh_"

        if gh issue comment "$ISSUE_NUM" --body "$COMMENT_BODY" 2>/dev/null; then
          log "Posted triage comment on issue #$ISSUE_NUM"
        else
          log "WARN: Failed to post comment on issue #$ISSUE_NUM"
        fi
      done
    else
      log "WARN: Roadmap agent output invalid JSON. Applying 'planned' label directly."
      # Fallback: just apply 'planned' label without detailed triage
      echo "$NEW_ISSUES" | jq -r '.[].number' | while IFS= read -r num; do
        gh issue edit "$num" --add-label "planned" 2>/dev/null || true
        log "Applied 'planned' label to issue #$num (fallback)"
      done
    fi
  fi

  # ── Split issues marked as needs-split ───────────────────────────────────
  local SPLIT_ISSUES SPLIT_COUNT
  SPLIT_ISSUES=$(jq '[.[] | select(
    (.labels | map(.name) | index("needs-split")) != null and
    (.labels | map(.name) | index("done")) == null
  )]' "$ISSUES_FILE")

  SPLIT_COUNT=$(echo "$SPLIT_ISSUES" | jq length)
  if [[ "$SPLIT_COUNT" -gt 0 ]]; then
    log "Found $SPLIT_COUNT issues needing split..."
    local SPLIT_PROMPT INTENT_FOR_SPLIT
    SPLIT_PROMPT=$(cat "$SCRIPT_DIR/prompts/split.md")
    INTENT_FOR_SPLIT=$(cat "$REPO_ROOT/docs/INTENT.md" 2>/dev/null || echo "(not found)")

    echo "$SPLIT_ISSUES" | jq -c '.[]' | while IFS= read -r split_issue; do
      local S_NUM S_TITLE S_BODY SPLIT_INPUT SPLIT_STDERR SPLIT_OUTPUT SPLIT_JSON
      S_NUM=$(echo "$split_issue" | jq -r '.number')
      S_TITLE=$(echo "$split_issue" | jq -r '.title')
      S_BODY=$(echo "$split_issue" | jq -r '.body // ""')

      SPLIT_INPUT="$SPLIT_PROMPT

## docs/INTENT.md
$INTENT_FOR_SPLIT

## Issue to Split

- **Number**: #$S_NUM
- **Title**: $S_TITLE
- **Body**: $S_BODY"

      log "Splitting issue #$S_NUM..."
      SPLIT_STDERR="/tmp/claude/agent-split-stderr.log"
      SPLIT_OUTPUT=$(claude -p "$SPLIT_INPUT" \
        --max-turns "$ROADMAP_MAX_TURNS" \
        --max-budget-usd "$MAX_BUDGET_USD" \
        2>"$SPLIT_STDERR") || true
      if check_rate_limit "$SPLIT_STDERR"; then flag_rate_limit; break; fi

      SPLIT_JSON=$(echo "$SPLIT_OUTPUT" | sed -n '/^```json$/,/^```$/{ /^```/d; p; }')

      if echo "$SPLIT_JSON" | jq empty 2>/dev/null; then
        echo "$SPLIT_JSON" | jq -c '.[]' | while IFS= read -r sub; do
          local SUB_TITLE SUB_BODY SUB_LABELS
          SUB_TITLE=$(echo "$sub" | jq -r '.title')
          SUB_BODY=$(echo "$sub" | jq -r '.body')
          SUB_LABELS=$(echo "$sub" | jq -r '.labels // ["agent"] | join(",")')

          if gh issue create --title "$SUB_TITLE" --body "$SUB_BODY" --label "$SUB_LABELS" 2>/dev/null; then
            log "Created sub-issue: $SUB_TITLE"
          else
            log "WARN: Failed to create sub-issue: $SUB_TITLE"
          fi
        done

        # Close parent issue
        gh issue comment "$S_NUM" --body "Split into sub-issues by agent/loop.sh. Closing parent." 2>/dev/null || true
        gh issue edit "$S_NUM" --add-label "done" --remove-label "needs-split" 2>/dev/null || true
        gh issue close "$S_NUM" 2>/dev/null || true
        log "Parent issue #$S_NUM closed after split"
      else
        log "WARN: Split agent output invalid JSON for issue #$S_NUM. Skipping."
      fi
    done
  fi

  if is_rate_limited; then return 2; fi

  return 0
}
