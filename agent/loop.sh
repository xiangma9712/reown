#!/usr/bin/env bash
# agent/loop.sh — Autonomous agent outer loop
# Picks tasks from GitHub issues (label-based), implements them via claude -p,
# creates PRs, waits for CI, merges, and closes linked issues.
#
# Label workflow:
#   agent           — issue is in the agent task pool
#   planned         — triaged by roadmap agent, ready for implementation
#   doing           — currently being worked on
#   done            — completed (issue also closed)
#   needs-split     — too large, needs breakdown
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Defaults ──────────────────────────────────────────────────────────────────
MAX_ITERATIONS=0       # 0 = infinite
MAX_BUDGET_USD=5       # per claude invocation
AGENT_LABEL="agent"
SLEEP_SECONDS=5
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
      echo "Label workflow:"
      echo "  agent       Issue is in the agent task pool"
      echo "  planned     Triaged by roadmap agent, ready for implementation"
      echo "  doing       Currently being worked on by an agent"
      echo "  done        Completed (issue also closed)"
      echo "  needs-split Too large, needs breakdown"
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
  # Fetch latest remote state before pulling
  log "Fetching latest from origin..."
  if ! git fetch origin 2>/dev/null; then
    log "WARN: git fetch origin failed. Continuing with local state."
  fi
  if ! git pull --ff-only origin main 2>/dev/null; then
    log "WARN: git pull --ff-only failed. Attempting reset to origin/main."
    git reset --hard origin/main 2>/dev/null || true
  fi
}

verify_main_is_latest() {
  cd "$REPO_ROOT"
  local local_head remote_head
  local_head=$(git rev-parse HEAD)
  remote_head=$(git rev-parse origin/main 2>/dev/null) || true
  if [[ -z "$remote_head" ]]; then
    log "WARN: Could not resolve origin/main. Skipping verification."
    return 0
  fi
  if [[ "$local_head" != "$remote_head" ]]; then
    log "ERROR: Local main ($local_head) does not match origin/main ($remote_head)."
    log "Attempting to sync..."
    git fetch origin 2>/dev/null || true
    git reset --hard origin/main 2>/dev/null || true
    # Re-check after sync
    local_head=$(git rev-parse HEAD)
    remote_head=$(git rev-parse origin/main 2>/dev/null) || true
    if [[ "$local_head" != "$remote_head" ]]; then
      log "ERROR: Still out of sync after reset. Aborting iteration."
      return 1
    fi
    log "Synced to origin/main successfully."
  fi
  return 0
}

cleanup_branch() {
  local branch="$1"
  cd "$REPO_ROOT"
  git checkout -- . 2>/dev/null || true
  git clean -fd 2>/dev/null || true
  git checkout main 2>/dev/null || true
  git branch -D "$branch" 2>/dev/null || true
}

# Rate limit detection — uses a flag file so it works across subshells (pipes).
RATE_LIMIT_FLAG="/tmp/claude/agent-rate-limited"
rm -f "$RATE_LIMIT_FLAG"

# Check if a stderr log file contains rate limit errors from Claude CLI.
# Returns 0 (true) if rate limit detected, 1 otherwise.
check_rate_limit() {
  local stderr_file="$1"
  if [[ -f "$stderr_file" ]] && grep -qi "rate limit\|rate_limit\|429\|too many requests\|overloaded" "$stderr_file" 2>/dev/null; then
    return 0
  fi
  return 1
}

# Check if rate limit has been flagged (works across subshells).
is_rate_limited() {
  [[ -f "$RATE_LIMIT_FLAG" ]]
}

# Flag rate limit and log a fatal message. Safe to call from subshells.
flag_rate_limit() {
  touch "$RATE_LIMIT_FLAG"
  log "FATAL: Claude API rate limit hit. Stopping loop to avoid further throttling."
}

# Check if any Rust-related files changed on the current branch vs main
has_rust_changes() {
  cd "$REPO_ROOT"
  local changed_files
  changed_files=$(git diff --name-only main...HEAD 2>/dev/null || git diff --name-only main 2>/dev/null || echo "")
  if [[ -z "$changed_files" ]]; then
    # If we can't determine changes, assume Rust changes to be safe
    return 0
  fi
  echo "$changed_files" | grep -qE '\.(rs|toml|lock)$|^Cargo\.'
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

# Check if a label exists on the repo, create it if not
ensure_label_exists() {
  local label_name="$1"
  local label_color="${2:-ededed}"
  local label_desc="${3:-}"
  if ! gh label list --json name -q ".[].name" 2>/dev/null | grep -qx "$label_name"; then
    gh label create "$label_name" --color "$label_color" --description "$label_desc" 2>/dev/null || true
  fi
}

# ── Ensure required labels exist ─────────────────────────────────────────────
ensure_labels() {
  ensure_label_exists "planned"     "0e8a16" "Triaged and ready for implementation"
  ensure_label_exists "doing"       "fbca04" "Currently being worked on"
  ensure_label_exists "done"        "5319e7" "Completed"
  ensure_label_exists "needs-split" "d93f0b" "Too large, needs breakdown"
}

# ── Main Loop ─────────────────────────────────────────────────────────────────
iteration=0

log "=== Agent loop started (max_iterations=$MAX_ITERATIONS, label=$AGENT_LABEL) ==="

# Ensure required labels exist on the repo
ensure_labels

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

  # ── Step 2: Fetch GitHub issues ─────────────────────────────────────────────
  ISSUES_FILE="/tmp/claude/agent-issues.json"
  mkdir -p /tmp/claude
  if gh issue list --label "$AGENT_LABEL" --state open --json number,title,body,labels \
       --limit 50 > "$ISSUES_FILE" 2>/dev/null; then
    issue_count=$(jq length "$ISSUES_FILE")
    log "Fetched $issue_count open issues with label '$AGENT_LABEL'"
  else
    log "ERROR: Failed to fetch GitHub issues. Cannot proceed without issue source."
    sleep "$SLEEP_SECONDS"
    continue
  fi

  if [[ "$(jq length "$ISSUES_FILE")" -eq 0 ]]; then
    log "No open issues with label '$AGENT_LABEL'. Sleeping..."
    sleep "$SLEEP_SECONDS"
    continue
  fi

  # ── Step 3: Triage — label new issues as 'planned' ─────────────────────────
  # Find issues that have 'agent' label but NOT 'planned', 'doing', 'done', or 'needs-split'
  NEW_ISSUES=$(jq '[.[] | select(
    (.labels | map(.name) | index("planned")) == null and
    (.labels | map(.name) | index("doing")) == null and
    (.labels | map(.name) | index("done")) == null and
    (.labels | map(.name) | index("needs-split")) == null
  )]' "$ISSUES_FILE")

  NEW_ISSUE_COUNT=$(echo "$NEW_ISSUES" | jq length)
  if [[ "$NEW_ISSUE_COUNT" -gt 0 ]]; then
    log "Found $NEW_ISSUE_COUNT new issues to triage..."

    # Run roadmap agent to triage new issues
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
    ROADMAP_STDERR="/tmp/claude/agent-roadmap-stderr.log"
    ROADMAP_OUTPUT=$(claude -p "$ROADMAP_INPUT" \
      --max-turns "$ROADMAP_MAX_TURNS" \
      --max-budget-usd "$MAX_BUDGET_USD" \
      2>"$ROADMAP_STDERR") || true
    if check_rate_limit "$ROADMAP_STDERR"; then flag_rate_limit; break; fi

    # Extract JSON from output (between ```json and ```)
    TRIAGE_JSON=$(echo "$ROADMAP_OUTPUT" | sed -n '/^```json$/,/^```$/{ /^```/d; p; }')

    if echo "$TRIAGE_JSON" | jq empty 2>/dev/null; then
      # Apply 'planned' label and post triage comment for each issue
      echo "$TRIAGE_JSON" | jq -c '.[]' 2>/dev/null | while IFS= read -r entry; do
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

  # ── Step 3b: Split issues marked as needs-split ────────────────────────────
  SPLIT_ISSUES=$(jq '[.[] | select(
    (.labels | map(.name) | index("needs-split")) != null and
    (.labels | map(.name) | index("done")) == null
  )]' "$ISSUES_FILE")

  SPLIT_COUNT=$(echo "$SPLIT_ISSUES" | jq length)
  if [[ "$SPLIT_COUNT" -gt 0 ]]; then
    log "Found $SPLIT_COUNT issues needing split..."
    SPLIT_PROMPT=$(cat "$SCRIPT_DIR/prompts/split.md")
    INTENT_FOR_SPLIT=$(cat "$REPO_ROOT/docs/INTENT.md" 2>/dev/null || echo "(not found)")

    echo "$SPLIT_ISSUES" | jq -c '.[]' | while IFS= read -r split_issue; do
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

  if is_rate_limited; then break; fi

  # ── Step 4: Select next task from GitHub issues ─────────────────────────────
  # Pick the oldest issue with 'agent' + 'planned' labels, but NOT 'doing', 'done', 'needs-split'
  TASK_ISSUE_JSON=$(jq 'map(select(
    (.labels | map(.name) | index("planned")) != null and
    (.labels | map(.name) | index("doing")) == null and
    (.labels | map(.name) | index("done")) == null and
    (.labels | map(.name) | index("needs-split")) == null
  )) | sort_by(.number) | first // empty' "$ISSUES_FILE")

  if [[ -z "$TASK_ISSUE_JSON" || "$TASK_ISSUE_JSON" == "null" ]]; then
    log "No planned tasks available. Sleeping..."
    sleep "$SLEEP_SECONDS"
    continue
  fi

  TASK_ISSUE=$(echo "$TASK_ISSUE_JSON" | jq -r '.number')
  TASK_TITLE=$(echo "$TASK_ISSUE_JSON" | jq -r '.title')
  TASK_DESC=$(echo "$TASK_ISSUE_JSON" | jq -r '.body // ""')
  TASK_ID="issue-${TASK_ISSUE}"

  log "Selected task: #$TASK_ISSUE — $TASK_TITLE"

  if should_stop; then
    log "Stop requested before implementation. Exiting gracefully."
    rm -f "$STOP_FILE"
    break
  fi

  # ── Step 5: Mark issue as 'doing' ──────────────────────────────────────────
  if ! gh issue edit "$TASK_ISSUE" --add-label "doing" 2>/dev/null; then
    log "WARN: Failed to apply 'doing' label to issue #$TASK_ISSUE"
  fi

  # ── Step 6: Create feature branch & implement ──────────────────────────────
  BRANCH_NAME="agent/$TASK_ID"
  cd "$REPO_ROOT"

  # Guard: verify main is up-to-date with origin before branching
  if ! verify_main_is_latest; then
    log "ERROR: Cannot verify main is latest for #$TASK_ISSUE. Skipping iteration."
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    sleep "$SLEEP_SECONDS"
    continue
  fi

  git checkout -b "$BRANCH_NAME"

  IMPLEMENT_PROMPT=$(cat "$SCRIPT_DIR/prompts/implement.md")
  IMPLEMENT_INPUT="$IMPLEMENT_PROMPT

## Task to Implement

- **ID**: $TASK_ID
- **Issue**: #$TASK_ISSUE
- **Title**: $TASK_TITLE
- **Description**: $TASK_DESC"

  log "Running implementation agent for #$TASK_ISSUE..."
  CLAUDE_STDERR="/tmp/claude/agent-implement-stderr.log"
  claude -p "$IMPLEMENT_INPUT" \
       --max-turns "$IMPLEMENT_MAX_TURNS" \
       --max-budget-usd "$MAX_BUDGET_USD" \
       --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
       2>"$CLAUDE_STDERR"
  CLAUDE_EXIT=$?

  # Rate limit check — stop the entire loop
  if check_rate_limit "$CLAUDE_STDERR"; then
    flag_rate_limit
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    break
  fi

  if [[ $CLAUDE_EXIT -ne 0 ]] || grep -qi "max turns\|max budget" "$CLAUDE_STDERR" 2>/dev/null; then
    if grep -qi "max turns\|max budget" "$CLAUDE_STDERR" 2>/dev/null; then
      log "ERROR: Implementation agent hit resource limit for #$TASK_ISSUE. Needs split."
    else
      log "ERROR: Implementation agent failed for #$TASK_ISSUE (exit=$CLAUDE_EXIT)"
    fi
    mark_needs_split "$TASK_ISSUE"
    cleanup_branch "$BRANCH_NAME"
    sleep "$SLEEP_SECONDS"
    continue
  fi

  # ── Local verification ─────────────────────────────────────────────────────
  cd "$REPO_ROOT"
  if has_rust_changes; then
    log "Rust files changed — running cargo test and clippy..."
    if ! cargo test 2>/dev/null; then
      log "WARN: Tests failed after implementation. Attempting fix..."
      FIX_STDERR="/tmp/claude/agent-fix-stderr.log"
      claude -p "cargo test is failing. Read the test output, find the root cause, and fix the implementation (not the tests). Then run cargo test again to verify." \
        --max-turns "$FIX_MAX_TURNS" \
        --max-budget-usd "$MAX_BUDGET_USD" \
        --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
        2>"$FIX_STDERR" || true
      if check_rate_limit "$FIX_STDERR"; then
        flag_rate_limit
        gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
        cleanup_branch "$BRANCH_NAME"
        break
      fi

      if ! cargo test 2>/dev/null; then
        log "ERROR: Tests still failing for #$TASK_ISSUE. Skipping."
        mark_needs_split "$TASK_ISSUE"
        cleanup_branch "$BRANCH_NAME"
        sleep "$SLEEP_SECONDS"
        continue
      fi
    fi

    if ! cargo clippy --all-targets -- -D warnings 2>/dev/null; then
      log "WARN: Clippy failed. Attempting fix..."
      FIX_STDERR="/tmp/claude/agent-fix-stderr.log"
      claude -p "cargo clippy --all-targets -- -D warnings is failing. Fix all clippy warnings in the code you changed." \
        --max-turns "$FIX_MAX_TURNS" \
        --max-budget-usd "$MAX_BUDGET_USD" \
        --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
        2>"$FIX_STDERR" || true
      if check_rate_limit "$FIX_STDERR"; then
        flag_rate_limit
        gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
        cleanup_branch "$BRANCH_NAME"
        break
      fi

      if ! cargo clippy --all-targets -- -D warnings 2>/dev/null; then
        log "ERROR: Clippy still failing for #$TASK_ISSUE. Skipping."
        mark_needs_split "$TASK_ISSUE"
        cleanup_branch "$BRANCH_NAME"
        sleep "$SLEEP_SECONDS"
        continue
      fi
    fi
  else
    log "No Rust files changed — skipping cargo test and clippy."
  fi

  # ── Step 7: Pre-push verification — ensure working tree is clean ──────────
  cd "$REPO_ROOT"
  VERIFY_CLEAN_PASSED=false
  for verify_attempt in 1 2; do
    if git diff --quiet && git diff --cached --quiet && [[ -z "$(git ls-files --others --exclude-standard)" ]]; then
      VERIFY_CLEAN_PASSED=true
      break
    fi

    if [[ "$verify_attempt" -eq 1 ]]; then
      log "WARN: Working tree not clean before push. Attempting to commit remaining changes..."
      git add -A
      git commit -m "fix: commit remaining changes for #$TASK_ISSUE" 2>/dev/null || true

      # Re-run tests/clippy after committing leftover changes (only if Rust files changed)
      if has_rust_changes; then
        if ! cargo test 2>/dev/null || ! cargo clippy --all-targets -- -D warnings 2>/dev/null; then
          log "WARN: Tests/clippy failed after committing leftover changes. Invoking fix agent..."
          FIX_STDERR="/tmp/claude/agent-fix-stderr.log"
          claude -p "There were uncommitted changes that have been staged and committed. Now cargo test or clippy is failing. Fix the issues, commit, and ensure the tree is clean." \
            --max-turns "$FIX_MAX_TURNS" \
            --max-budget-usd "$MAX_BUDGET_USD" \
            --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
            2>"$FIX_STDERR" || true
          if check_rate_limit "$FIX_STDERR"; then
            flag_rate_limit
            gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
            cleanup_branch "$BRANCH_NAME"
            break 2  # break out of both the for loop and the while loop
          fi
        fi
      fi
    fi
  done

  if [[ "$VERIFY_CLEAN_PASSED" != "true" ]]; then
    log "ERROR: Working tree still not clean for #$TASK_ISSUE after fix attempt. Skipping."
    mark_needs_split "$TASK_ISSUE"
    cleanup_branch "$BRANCH_NAME"
    sleep "$SLEEP_SECONDS"
    continue
  fi

  log "Pre-push verification passed: working tree is clean."

  # ── Step 8: Push & create PR ───────────────────────────────────────────────
  cd "$REPO_ROOT"
  git push -u origin "$BRANCH_NAME"

  # ── Step 8b: Post-push verification — ensure all commits are pushed ──────
  cd "$REPO_ROOT"
  git fetch origin "$BRANCH_NAME" 2>/dev/null || true
  LOCAL_HEAD=$(git rev-parse HEAD)
  REMOTE_HEAD=$(git rev-parse "origin/$BRANCH_NAME" 2>/dev/null) || true
  if [[ -n "$REMOTE_HEAD" && "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
    log "WARN: Local HEAD ($LOCAL_HEAD) != remote ($REMOTE_HEAD). Re-pushing..."
    git push origin "$BRANCH_NAME" 2>/dev/null || true
    git fetch origin "$BRANCH_NAME" 2>/dev/null || true
    REMOTE_HEAD=$(git rev-parse "origin/$BRANCH_NAME" 2>/dev/null) || true
    if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
      log "ERROR: Still out of sync after re-push for #$TASK_ISSUE. Skipping."
      mark_needs_split "$TASK_ISSUE"
      cleanup_branch "$BRANCH_NAME"
      sleep "$SLEEP_SECONDS"
      continue
    fi
  fi

  log "Post-push verification passed: local and remote are in sync."

  PR_BODY="## Summary

Implements issue #$TASK_ISSUE: $TASK_TITLE

$TASK_DESC

Closes #$TASK_ISSUE

---
Generated by agent/loop.sh"

  PR_URL=$(gh pr create \
    --title "feat: $TASK_TITLE" \
    --body "$PR_BODY" \
    --base main \
    --head "$BRANCH_NAME" 2>/dev/null) || true

  if [[ -z "$PR_URL" ]]; then
    log "ERROR: Failed to create PR for #$TASK_ISSUE"
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    sleep "$SLEEP_SECONDS"
    continue
  fi

  log "PR created: $PR_URL"

  # ── Step 8c: Post-PR verification — ensure PR diff contains changes ──────
  PR_DIFF_STAT=$(gh pr diff "$PR_URL" --name-only 2>/dev/null) || true
  if [[ -z "$PR_DIFF_STAT" ]]; then
    log "ERROR: PR has no file changes for #$TASK_ISSUE. The PR diff is empty."
    gh pr close "$PR_URL" 2>/dev/null || true
    mark_needs_split "$TASK_ISSUE"
    cleanup_branch "$BRANCH_NAME"
    sleep "$SLEEP_SECONDS"
    continue
  fi

  PR_FILE_COUNT=$(echo "$PR_DIFF_STAT" | wc -l | tr -d ' ')
  log "Post-PR verification passed: PR contains changes in $PR_FILE_COUNT file(s)."

  # ── Step 9: Wait for CI ────────────────────────────────────────────────────
  CI_PASSED=false
  for attempt in 1 2; do
    log "Waiting for CI checks (attempt $attempt)..."
    if gh pr checks "$PR_URL" --watch --fail-fast 2>/dev/null; then
      CI_PASSED=true
      break
    fi

    if [[ "$attempt" -eq 1 ]]; then
      log "CI failed. Attempting fix..."
      FIX_STDERR="/tmp/claude/agent-fix-stderr.log"
      claude -p "CI checks failed for this PR. Read the CI logs, fix the issues, commit, and push." \
        --max-turns "$FIX_MAX_TURNS" \
        --max-budget-usd "$MAX_BUDGET_USD" \
        --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
        2>"$FIX_STDERR" || true
      if check_rate_limit "$FIX_STDERR"; then
        flag_rate_limit
        gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
        break 2  # break out of CI for-loop and main while-loop
      fi
      cd "$REPO_ROOT"
      git push 2>/dev/null || true
    fi
  done

  if [[ "$CI_PASSED" != "true" ]]; then
    log "ERROR: CI failed twice for #$TASK_ISSUE. Leaving PR open for manual review."
    gh pr comment "$PR_URL" --body "CI failed after 2 attempts. Needs manual review." 2>/dev/null || true
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    sleep "$SLEEP_SECONDS"
    continue
  fi

  # ── Step 10: Merge PR ───────────────────────────────────────────────────────
  log "CI passed. Merging PR..."
  if gh pr merge "$PR_URL" --squash --delete-branch 2>/dev/null; then
    log "PR merged: $PR_URL"
  else
    log "ERROR: Failed to merge PR. Leaving for manual review."
    gh issue edit "$TASK_ISSUE" --remove-label "doing" 2>/dev/null || true
    cleanup_branch "$BRANCH_NAME"
    sleep "$SLEEP_SECONDS"
    continue
  fi

  # ── Step 11: Mark issue as done & close ────────────────────────────────────
  gh issue edit "$TASK_ISSUE" --add-label "done" --remove-label "doing" --remove-label "planned" 2>/dev/null || true
  gh issue comment "$TASK_ISSUE" \
    --body "Implemented in $PR_URL by agent/loop.sh" 2>/dev/null || true
  gh issue close "$TASK_ISSUE" 2>/dev/null || true
  log "Issue #$TASK_ISSUE marked as done and closed"

  # ── Step 12: Return to main ─────────────────────────────────────────────────
  cd "$REPO_ROOT"
  git checkout main
  git pull --ff-only origin main 2>/dev/null || true

  log "Task #$TASK_ISSUE completed successfully."

  # ── Sleep ──────────────────────────────────────────────────────────────────
  if [[ "$MAX_ITERATIONS" -gt 0 && "$iteration" -ge "$MAX_ITERATIONS" ]]; then
    log "Reached max iterations. Exiting."
    break
  fi

  log "Sleeping ${SLEEP_SECONDS}s before next iteration..."
  sleep "$SLEEP_SECONDS"
done

log "=== Agent loop finished ==="
