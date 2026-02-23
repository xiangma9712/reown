#!/usr/bin/env bash
# agent/loop.sh — Autonomous agent outer loop
# Picks tasks from prd.json, implements them via claude -p, creates PRs,
# waits for CI, merges, and closes linked issues.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Defaults ──────────────────────────────────────────────────────────────────
MAX_ITERATIONS=0       # 0 = infinite
MAX_BUDGET_USD=5       # per claude invocation
AGENT_LABEL="agent"
SLEEP_SECONDS=30
ROADMAP_MAX_TURNS=10
IMPLEMENT_MAX_TURNS=30
FIX_MAX_TURNS=15

# ── Parse arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-iterations) MAX_ITERATIONS="$2"; shift 2 ;;
    --max-budget)     MAX_BUDGET_USD="$2";  shift 2 ;;
    --label)          AGENT_LABEL="$2";     shift 2 ;;
    --sleep)          SLEEP_SECONDS="$2";   shift 2 ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo "  --max-iterations N   Stop after N iterations (0=infinite, default: 0)"
      echo "  --max-budget USD     Max budget per claude call (default: 5)"
      echo "  --label LABEL        GitHub issue label to watch (default: agent)"
      echo "  --sleep SECONDS      Sleep between iterations (default: 30)"
      echo ""
      echo "Graceful stop:"
      echo "  Ctrl-C               Stop after current step completes"
      echo "  touch .agent-stop    Stop before next iteration starts"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Graceful shutdown ─────────────────────────────────────────────────────────
STOP_REQUESTED=false
STOP_FILE="$REPO_ROOT/.agent-stop"

request_stop() {
  STOP_REQUESTED=true
  echo ""
  echo "Graceful stop requested. Will exit after current step completes."
  echo "  (Press Ctrl-C again to force-quit)"
  trap - SIGINT SIGTERM  # second signal = immediate exit
}
trap request_stop SIGINT SIGTERM

should_stop() {
  [[ "$STOP_REQUESTED" == "true" ]] || [[ -f "$STOP_FILE" ]]
}

# ── Helpers ───────────────────────────────────────────────────────────────────
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg"
  echo "$msg" >> "$REPO_ROOT/progress.txt"
}

ensure_clean_main() {
  cd "$REPO_ROOT"
  local current_branch
  current_branch=$(git branch --show-current)
  if [[ "$current_branch" != "main" ]]; then
    log "WARN: Not on main (on '$current_branch'). Switching to main."
    git checkout -- . 2>/dev/null || true
    git clean -fd 2>/dev/null || true
    git checkout main
  fi
  if ! git diff --quiet || ! git diff --cached --quiet; then
    log "WARN: Working tree is dirty on main. Resetting."
    git checkout -- . 2>/dev/null || true
    git clean -fd 2>/dev/null || true
  fi
  git pull --ff-only origin main 2>/dev/null || true
}

cleanup_branch() {
  local branch="$1"
  cd "$REPO_ROOT"
  git checkout -- . 2>/dev/null || true
  git clean -fd 2>/dev/null || true
  git checkout main 2>/dev/null || true
  git branch -D "$branch" 2>/dev/null || true
}

# ── Main Loop ─────────────────────────────────────────────────────────────────
iteration=0

log "=== Agent loop started (max_iterations=$MAX_ITERATIONS, label=$AGENT_LABEL) ==="

while true; do
  iteration=$((iteration + 1))
  if [[ "$MAX_ITERATIONS" -gt 0 && "$iteration" -gt "$MAX_ITERATIONS" ]]; then
    log "Reached max iterations ($MAX_ITERATIONS). Exiting."
    break
  fi

  if should_stop; then
    log "Stop requested. Exiting gracefully."
    rm -f "$STOP_FILE"
    break
  fi

  log "--- Iteration $iteration ---"

  # ── Step 1: Ensure clean main ──────────────────────────────────────────────
  ensure_clean_main

  # ── Step 2: Sync GitHub Issues ─────────────────────────────────────────────
  ISSUES_FILE="/tmp/claude/agent-issues.json"
  mkdir -p /tmp/claude
  if gh issue list --label "$AGENT_LABEL" --state open --json number,title,body,labels \
       --limit 50 > "$ISSUES_FILE" 2>/dev/null; then
    issue_count=$(jq length "$ISSUES_FILE")
    log "Fetched $issue_count open issues with label '$AGENT_LABEL'"
  else
    log "WARN: Failed to fetch issues (gh not configured?). Continuing with prd.json only."
    echo "[]" > "$ISSUES_FILE"
  fi

  # ── Step 3: Roadmap — sync issues into prd.json ───────────────────────────
  if [[ "$(jq length "$ISSUES_FILE")" -gt 0 ]]; then
    log "Running roadmap agent to sync issues..."
    cp "$REPO_ROOT/prd.json" "$REPO_ROOT/prd.json.bak"

    ROADMAP_PROMPT=$(cat "$SCRIPT_DIR/prompts/roadmap.md")
    ISSUES_CONTENT=$(cat "$ISSUES_FILE")
    CURRENT_PRD=$(cat "$REPO_ROOT/prd.json")
    INTENT_CONTENT=$(cat "$REPO_ROOT/docs/INTENT.md" 2>/dev/null || echo "(INTENT.md not found)")

    ROADMAP_INPUT="$ROADMAP_PROMPT

## docs/INTENT.md (Product Vision)
$INTENT_CONTENT

## GitHub Issues (JSON)
\`\`\`json
$ISSUES_CONTENT
\`\`\`

## Current prd.json
\`\`\`json
$CURRENT_PRD
\`\`\`"

    ROADMAP_OUTPUT=$(claude -p "$ROADMAP_INPUT" \
      --max-turns "$ROADMAP_MAX_TURNS" \
      --max-budget-usd "$MAX_BUDGET_USD" \
      2>/dev/null) || true

    # Extract JSON from output (between ```json and ```)
    EXTRACTED_JSON=$(echo "$ROADMAP_OUTPUT" | sed -n '/^```json$/,/^```$/{ /^```/d; p; }')

    if echo "$EXTRACTED_JSON" | jq empty 2>/dev/null; then
      echo "$EXTRACTED_JSON" > "$REPO_ROOT/prd.json"
      log "prd.json updated by roadmap agent"
    else
      log "WARN: Roadmap agent output invalid JSON. Keeping old prd.json."
      cp "$REPO_ROOT/prd.json.bak" "$REPO_ROOT/prd.json"
    fi
    rm -f "$REPO_ROOT/prd.json.bak"
  fi

  # ── Step 4: Select next task ───────────────────────────────────────────────
  TASK=$(jq -r '
    .tasks
    | map(select(.passed == false))
    | sort_by(.priority)
    | first
    // empty
  ' "$REPO_ROOT/prd.json" 2>/dev/null) || true

  if [[ -z "$TASK" || "$TASK" == "null" ]]; then
    log "No pending tasks. Sleeping..."
    sleep "$SLEEP_SECONDS"
    continue
  fi

  TASK_ID=$(echo "$TASK" | jq -r '.id')
  TASK_TITLE=$(echo "$TASK" | jq -r '.title')
  TASK_DESC=$(echo "$TASK" | jq -r '.description')
  TASK_ISSUE=$(echo "$TASK" | jq -r '.issue // empty')

  log "Selected task: $TASK_ID — $TASK_TITLE"

  if should_stop; then
    log "Stop requested before implementation. Exiting gracefully."
    rm -f "$STOP_FILE"
    break
  fi

  # ── Step 5: Create feature branch & implement ──────────────────────────────
  BRANCH_NAME="agent/$TASK_ID"
  cd "$REPO_ROOT"
  git checkout -b "$BRANCH_NAME"

  IMPLEMENT_PROMPT=$(cat "$SCRIPT_DIR/prompts/implement.md")
  IMPLEMENT_INPUT="$IMPLEMENT_PROMPT

## Task to Implement

- **ID**: $TASK_ID
- **Title**: $TASK_TITLE
- **Description**: $TASK_DESC"

  log "Running implementation agent for $TASK_ID..."
  if ! claude -p "$IMPLEMENT_INPUT" \
       --max-turns "$IMPLEMENT_MAX_TURNS" \
       --max-budget-usd "$MAX_BUDGET_USD" \
       --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
       2>/dev/null; then
    log "ERROR: Implementation agent failed for $TASK_ID"
    cleanup_branch "$BRANCH_NAME"
    sleep "$SLEEP_SECONDS"
    continue
  fi

  # ── Local verification ─────────────────────────────────────────────────────
  cd "$REPO_ROOT"
  if ! cargo test 2>/dev/null; then
    log "WARN: Tests failed after implementation. Attempting fix..."
    claude -p "cargo test is failing. Read the test output, find the root cause, and fix the implementation (not the tests). Then run cargo test again to verify." \
      --max-turns "$FIX_MAX_TURNS" \
      --max-budget-usd "$MAX_BUDGET_USD" \
      --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
      2>/dev/null || true

    if ! cargo test 2>/dev/null; then
      log "ERROR: Tests still failing for $TASK_ID. Skipping."
      cleanup_branch "$BRANCH_NAME"
      sleep "$SLEEP_SECONDS"
      continue
    fi
  fi

  if ! cargo clippy --all-targets -- -D warnings 2>/dev/null; then
    log "WARN: Clippy failed. Attempting fix..."
    claude -p "cargo clippy --all-targets -- -D warnings is failing. Fix all clippy warnings in the code you changed." \
      --max-turns "$FIX_MAX_TURNS" \
      --max-budget-usd "$MAX_BUDGET_USD" \
      --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
      2>/dev/null || true

    if ! cargo clippy --all-targets -- -D warnings 2>/dev/null; then
      log "ERROR: Clippy still failing for $TASK_ID. Skipping."
      cleanup_branch "$BRANCH_NAME"
      sleep "$SLEEP_SECONDS"
      continue
    fi
  fi

  # ── Step 6: Push & create PR ───────────────────────────────────────────────
  cd "$REPO_ROOT"
  git push -u origin "$BRANCH_NAME"

  PR_BODY="## Summary

Implements task **$TASK_ID**: $TASK_TITLE

$TASK_DESC"

  if [[ -n "$TASK_ISSUE" ]]; then
    PR_BODY="$PR_BODY

Closes #$TASK_ISSUE"
  fi

  PR_BODY="$PR_BODY

---
Generated by agent/loop.sh"

  PR_URL=$(gh pr create \
    --title "feat: $TASK_TITLE" \
    --body "$PR_BODY" \
    --base main \
    --head "$BRANCH_NAME" 2>/dev/null) || true

  if [[ -z "$PR_URL" ]]; then
    log "ERROR: Failed to create PR for $TASK_ID"
    cleanup_branch "$BRANCH_NAME"
    sleep "$SLEEP_SECONDS"
    continue
  fi

  log "PR created: $PR_URL"

  # ── Step 7: Wait for CI ────────────────────────────────────────────────────
  CI_PASSED=false
  for attempt in 1 2; do
    log "Waiting for CI checks (attempt $attempt)..."
    if gh pr checks "$PR_URL" --watch --fail-fast 2>/dev/null; then
      CI_PASSED=true
      break
    fi

    if [[ "$attempt" -eq 1 ]]; then
      log "CI failed. Attempting fix..."
      claude -p "CI checks failed for this PR. Read the CI logs, fix the issues, commit, and push." \
        --max-turns "$FIX_MAX_TURNS" \
        --max-budget-usd "$MAX_BUDGET_USD" \
        --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
        2>/dev/null || true
      cd "$REPO_ROOT"
      git push 2>/dev/null || true
    fi
  done

  if [[ "$CI_PASSED" != "true" ]]; then
    log "ERROR: CI failed twice for $TASK_ID. Leaving PR open for manual review."
    gh pr comment "$PR_URL" --body "CI failed after 2 attempts. Needs manual review." 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    sleep "$SLEEP_SECONDS"
    continue
  fi

  # ── Step 8: Merge PR ───────────────────────────────────────────────────────
  log "CI passed. Merging PR..."
  if gh pr merge "$PR_URL" --squash --delete-branch 2>/dev/null; then
    log "PR merged: $PR_URL"
  else
    log "ERROR: Failed to merge PR. Leaving for manual review."
    cleanup_branch "$BRANCH_NAME"
    sleep "$SLEEP_SECONDS"
    continue
  fi

  # ── Step 9: Close linked issue ─────────────────────────────────────────────
  if [[ -n "$TASK_ISSUE" ]]; then
    gh issue comment "$TASK_ISSUE" \
      --body "Implemented in $PR_URL by agent/loop.sh" 2>/dev/null || true
    gh issue close "$TASK_ISSUE" 2>/dev/null || true
    log "Issue #$TASK_ISSUE closed"
  fi

  # ── Step 10: Update prd.json & cleanup ─────────────────────────────────────
  cd "$REPO_ROOT"
  git checkout main
  git pull --ff-only origin main 2>/dev/null || true

  # Mark task as passed in prd.json
  UPDATED_PRD=$(jq --arg id "$TASK_ID" '
    .tasks |= map(if .id == $id then .passed = true else . end)
  ' "$REPO_ROOT/prd.json")
  echo "$UPDATED_PRD" > "$REPO_ROOT/prd.json"

  # Commit the prd.json update
  git add prd.json
  git commit -m "chore: mark $TASK_ID as passed in prd.json" 2>/dev/null || true
  git push origin main 2>/dev/null || true

  log "Task $TASK_ID completed successfully."

  # ── Sleep ──────────────────────────────────────────────────────────────────
  if [[ "$MAX_ITERATIONS" -gt 0 && "$iteration" -ge "$MAX_ITERATIONS" ]]; then
    log "Reached max iterations. Exiting."
    break
  fi

  log "Sleeping ${SLEEP_SECONDS}s before next iteration..."
  sleep "$SLEEP_SECONDS"
done

log "=== Agent loop finished ==="
