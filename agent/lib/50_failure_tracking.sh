# agent/lib/50_failure_tracking.sh — Iteration result tracking + self-review

# File to persist iteration results across the loop
ITERATION_RESULTS_FILE="${AGENT_LOG_BASE:-/tmp/claude/agent-logs}/iteration-results.log"

# Record an iteration result.
# Usage: record_iteration_result <success|fail> [failed_step] [issue_num]
record_iteration_result() {
  local result="$1"
  local step="${2:-unknown}"
  local issue="${3:-}"
  echo "$(date '+%Y-%m-%d %H:%M:%S') $result $step $issue" >> "$ITERATION_RESULTS_FILE"
}

# Count failures in the last N recorded iterations.
# Usage: recent_failure_count [N]
recent_failure_count() {
  local n="${1:-5}"
  [[ -f "$ITERATION_RESULTS_FILE" ]] || { echo 0; return; }
  local count
  count=$(tail -n "$n" "$ITERATION_RESULTS_FILE" | grep -c ' fail ' 2>/dev/null || echo 0)
  echo "$count"
}

# True if 2+ failures in the last 5 iterations — trigger self-review.
should_create_review_issue() {
  local count
  count=$(recent_failure_count 5)
  [[ "$count" -ge 2 ]]
}

# Reset failure history (e.g. after successful self-review).
reset_failure_history() {
  if [[ -f "$ITERATION_RESULTS_FILE" ]]; then
    log "Resetting failure history after successful self-review."
    : > "$ITERATION_RESULTS_FILE"
  fi
}

# True if 4+ failures in the last 5 iterations — exit loop.
should_exit_on_failure_rate() {
  local count
  count=$(recent_failure_count 5)
  [[ "$count" -ge 4 ]]
}

# Find or create a self-review issue for agent loop problems.
# Prints the issue number on success, empty string on failure.
create_or_find_review_issue() {
  # Check for existing open self-review issue
  local existing
  existing=$(gh issue list --label "self-review" --state open --json number -q '.[0].number' 2>/dev/null || echo "")
  if [[ -n "$existing" ]]; then
    log "Self-review issue already exists: #$existing"
    echo "$existing"
    return 0
  fi

  # Gather failure context
  local failures recent_log
  failures=$(tail -n 10 "$ITERATION_RESULTS_FILE" 2>/dev/null || echo "(no history)")
  recent_log=$(tail -n 50 "$REPO_ROOT/progress.txt" 2>/dev/null || echo "(no log)")

  local log_base="${AGENT_LOG_BASE:-/tmp/claude/agent-logs}"

  local issue_body
  issue_body="## Agent Loop 見直し

直近のイテレーションで失敗が頻発しています。失敗パターンを分析し、agent loop を修正してください。

## 失敗履歴

\`\`\`
$failures
\`\`\`

## 直近のログ（progress.txt）

\`\`\`
$recent_log
\`\`\`

## 調査手順

**ローカルのイテレーションログを必ず読んでください。** 失敗時のログは自動保持されています。

1. \`$log_base/\` 配下のイテレーションログディレクトリ（\`iter-NNN/\`）を確認する
2. 各ディレクトリ内の \`*.stdout.log\` と \`*.stderr.log\` を読み、失敗の根本原因を特定する
3. \`$log_base/iteration-results.log\` で失敗したステップと issue 番号を照合する
4. 根本原因に基づいて \`agent/\` 配下のファイルを修正する

## ルール

- **このissueでは \`agent/\` ファイルの修正が許可されています**（通常の implement.md の制約を上書き）
- \`bash -n\` で全修正ファイルの構文チェックを必ず実施してください
- テスト実行は不要です（agent/ はシェルスクリプトのため）

---
_Automatically created by agent failure tracking_"

  local issue_url
  issue_url=$(gh issue create \
    --title "chore: agent loop 見直し（自動検出）" \
    --body "$issue_body" \
    --label "agent,planned,self-review,priority-high" 2>/dev/null) || true

  if [[ -n "$issue_url" ]]; then
    local issue_num
    issue_num=$(echo "$issue_url" | grep -oE '[0-9]+$')
    log "Created self-review issue: #$issue_num ($issue_url)"
    echo "$issue_num"
  else
    log "WARN: Failed to create self-review issue"
    echo ""
  fi
}
