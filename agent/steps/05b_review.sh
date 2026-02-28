# agent/steps/05b_review.sh — step_review: smart review (blocking/followup classification)
# Runs between verify and push. Never blocks the pipeline (never returns 1).
# Return: 0=ok, 2=break loop (rate limit only)

step_review() {
  cd "$REPO_ROOT"

  # ── Skip if no diff ────────────────────────────────────────────────────────
  local diff_output
  diff_output=$(git diff main...HEAD --name-only 2>/dev/null || echo "")
  if [[ -z "$diff_output" ]]; then
    log "Review: No diff against main. Skipping."
    return 0
  fi

  # ── Run review agent (read-only) ───────────────────────────────────────────
  local REVIEW_PROMPT REVIEW_INPUT REVIEW_OUTPUT
  REVIEW_PROMPT=$(cat "$SCRIPT_DIR/prompts/review.md")
  REVIEW_INPUT="$REVIEW_PROMPT

## Context

- **Issue**: #$TASK_ISSUE
- **Title**: $TASK_TITLE
- **Branch**: $BRANCH_NAME"

  log "Running smart review agent for #$TASK_ISSUE..."
  local review_rc=0
  REVIEW_OUTPUT=$(run_claude \
    --label "review-$TASK_ISSUE" \
    --timeout "$TIMEOUT_VERIFY_FIX" \
    --max-turns "$REVIEW_MAX_TURNS" \
    --allowedTools "Bash,Read,Glob,Grep" \
    -- "$REVIEW_INPUT") || review_rc=$?

  # Rate limit → break loop
  if [[ "$review_rc" -eq 2 ]]; then
    flag_rate_limit
    return 2
  fi

  # Timeout or error → pass (don't block pipeline)
  if [[ "$review_rc" -ne 0 ]]; then
    log "WARN: Review agent failed (rc=$review_rc). Treating as pass."
    return 0
  fi

  # ── Parse JSON output ─────────────────────────────────────────────────────
  local REVIEW_JSON BLOCKING_COUNT FOLLOWUP_COUNT
  REVIEW_JSON=$(echo "$REVIEW_OUTPUT" | sed -n '/^```json$/,/^```$/{ /^```/d; p; }')

  if ! echo "$REVIEW_JSON" | jq empty 2>/dev/null; then
    log "WARN: Review agent output is not valid JSON. Treating as pass."
    return 0
  fi

  BLOCKING_COUNT=$(echo "$REVIEW_JSON" | jq '.blocking | length' 2>/dev/null || echo "0")
  FOLLOWUP_COUNT=$(echo "$REVIEW_JSON" | jq '.followup | length' 2>/dev/null || echo "0")

  log "Review result: $BLOCKING_COUNT blocking, $FOLLOWUP_COUNT followup"

  # ── Handle blocking issues ─────────────────────────────────────────────────
  if [[ "$BLOCKING_COUNT" -gt 0 ]]; then
    log "Attempting to fix $BLOCKING_COUNT blocking issue(s)..."

    local BLOCKING_DESC
    BLOCKING_DESC=$(echo "$REVIEW_JSON" | jq -r '.blocking[] | "- \(.file):\(.line) — \(.issue)"' 2>/dev/null)

    local fix_rc=0
    run_claude \
      --label "review-fix-$TASK_ISSUE" \
      --timeout "$TIMEOUT_VERIFY_FIX" \
      --max-turns "$FIX_MAX_TURNS" \
      --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
      -- "以下のblocking指摘を修正してください。修正後、影響するテスト（cargo test等）を実行して確認してください。

$BLOCKING_DESC

修正が完了したらコミットしてください。" \
      >/dev/null || fix_rc=$?

    # Rate limit → break loop
    if [[ "$fix_rc" -eq 2 ]]; then
      flag_rate_limit
      return 2
    fi

    # Check if fix was successful (working tree clean + tests pass)
    cd "$REPO_ROOT"
    local fix_success=true

    if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
      log "WARN: Fix agent left uncommitted changes. Committing..."
      git_add_safe
      git commit -m "fix: address review blocking issues for #$TASK_ISSUE" 2>/dev/null || fix_success=false
    fi

    if [[ "$fix_rc" -ne 0 ]]; then
      fix_success=false
    fi

    if [[ "$fix_success" != "true" ]]; then
      log "WARN: Fix failed. Downgrading all blocking issues to followup."
      # Merge blocking into followup
      REVIEW_JSON=$(echo "$REVIEW_JSON" | jq '
        .followup += [.blocking[] | {
          title: ("fix: " + .issue),
          body: (.file + ":" + (.line | tostring) + " — " + .issue)
        }] | .blocking = []
      ' 2>/dev/null || echo "$REVIEW_JSON")
      BLOCKING_COUNT=0
      FOLLOWUP_COUNT=$(echo "$REVIEW_JSON" | jq '.followup | length' 2>/dev/null || echo "0")
    fi
  fi

  # ── Create followup issues ─────────────────────────────────────────────────
  if [[ "$FOLLOWUP_COUNT" -gt 0 ]]; then
    log "Creating $FOLLOWUP_COUNT followup issue(s)..."

    echo "$REVIEW_JSON" | jq -c '.followup[]' 2>/dev/null | while IFS= read -r entry; do
      local fu_title fu_body
      fu_title=$(echo "$entry" | jq -r '.title')
      fu_body=$(echo "$entry" | jq -r '.body')

      fu_body="$fu_body

---
_レビューエージェントが #$TASK_ISSUE のレビュー中に検出しました。_
_Automatically created by agent/loop.sh (smart review)_"

      if gh issue create --title "$fu_title" --body "$fu_body" --label "$AGENT_LABEL" 2>/dev/null; then
        log "  Created followup: $fu_title"
      else
        log "  WARN: Failed to create followup issue: $fu_title"
      fi
    done
  fi

  log "Smart review completed for #$TASK_ISSUE."
  return 0
}
