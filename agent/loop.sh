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
#   pend            — blocked (test/clippy/CI failure etc.), needs human review
#   self-review     — agent loop self-review (auto-created on repeated failures)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Source helper: loads a file, fatal on failure ────────────────────────────
safe_source() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    echo "FATAL: Missing file: $f" >&2; exit 1
  fi
  # shellcheck disable=SC1090
  source "$f"
}

# ── Load defaults (before argument parsing so CLI can override) ──────────────
safe_source "$SCRIPT_DIR/lib/00_config.sh"

# ── Parse arguments ──────────────────────────────────────────────────────────
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
      echo "  pend        Blocked, needs human review or retry"
      echo ""
      echo "Graceful stop:"
      echo "  Ctrl-C               Stop after current step completes"
      echo "  touch .agent-stop    Stop before next iteration starts"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Graceful shutdown ────────────────────────────────────────────────────────
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

# ── Initial one-time setup ───────────────────────────────────────────────────
# Source lib once at startup (for log, ensure_labels, etc.)
for f in "$SCRIPT_DIR"/lib/*.sh; do safe_source "$f"; done

# Clear rate limit flag from previous runs
rm -f "$RATE_LIMIT_FLAG"
mkdir -p /tmp/claude
# Clear stale iteration logs — only when there are no recent failures.
# When failures exist, logs are preserved for self-review investigation.
mkdir -p "${AGENT_LOG_BASE:-/tmp/claude/agent-logs}"
if [[ -f "${AGENT_LOG_BASE:-/tmp/claude/agent-logs}/iteration-results.log" ]] \
   && tail -n 5 "${AGENT_LOG_BASE:-/tmp/claude/agent-logs}/iteration-results.log" 2>/dev/null | grep -q ' fail '; then
  log "Recent failures detected — preserving iteration logs for investigation."
else
  rm -rf "${AGENT_LOG_BASE:-/tmp/claude/agent-logs}"/iter-*
fi

# Ensure required labels exist on the repo
ensure_labels

# Clean up orphaned labels from previous crashed runs
cleanup_orphaned_resources

# ── Step execution order ─────────────────────────────────────────────────────
STEP_ORDER=(step_setup step_triage step_select step_implement step_verify step_review step_push step_ci step_complete)

# Steps for self-review iterations (skip triage/select — task is pre-assigned)
REVIEW_STEP_ORDER=(step_setup step_implement step_verify step_review step_push step_ci step_complete)

# ── Main Loop ────────────────────────────────────────────────────────────────
iteration=0
_is_review_iteration=false

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

  # Check rate limit flag
  if is_rate_limited; then
    log "Rate limit flag detected. Exiting."
    break
  fi

  log "--- Iteration $iteration ---"

  # ── Set up iteration log directory ─────────────────────────────────────────
  init_iter_log_dir "$iteration"
  cleanup_old_iter_logs

  # ── Reset per-iteration state ────────────────────────────────────────────
  ISSUES_FILE="" TASK_ISSUE="" TASK_TITLE="" TASK_DESC="" TASK_ID=""
  BRANCH_NAME="" PR_URL=""
  _is_review_iteration=false
  _skip_is_benign=false  # set by steps to mark non-failure skips (e.g. already-implemented)

  # ── Hot-reload: re-source lib & steps every iteration ────────────────────
  for f in "$SCRIPT_DIR"/lib/*.sh; do safe_source "$f"; done
  for f in "$SCRIPT_DIR"/steps/*.sh; do safe_source "$f"; done

  # ── Failure rate check — before doing real work ─────────────────────────
  if should_exit_on_failure_rate; then
    log "FATAL: 過去5回のイテレーションで4回以上失敗しています。ループを終了します。"
    break
  fi

  # Determine which steps to run this iteration
  local_step_order=("${STEP_ORDER[@]}")

  if should_create_review_issue; then
    log "WARN: 過去5回のイテレーションで2回以上失敗。self-review issueを確認します。"
    review_issue_num=$(create_or_find_review_issue)

    if [[ -n "$review_issue_num" ]]; then
      log "Self-review issue #$review_issue_num を強制的にpickします。"
      _is_review_iteration=true

      # Pre-assign task variables (skip triage + select)
      TASK_ISSUE="$review_issue_num"
      TASK_TITLE="chore: agent loop 見直し（自動検出）"
      TASK_DESC=$(gh issue view "$review_issue_num" --json body -q '.body' 2>/dev/null || echo "")
      TASK_ID="issue-${TASK_ISSUE}"
      local_step_order=("${REVIEW_STEP_ORDER[@]}")
    fi
  fi

  # ── Execute steps sequentially ───────────────────────────────────────────
  _loop_action="next"
  _failed_step=""
  for step_fn in "${local_step_order[@]}"; do
    if ! type -t "$step_fn" >/dev/null 2>&1; then
      log "FATAL: Step function '$step_fn' not defined."
      _loop_action="break"; break
    fi

    rc=0
    if "$step_fn"; then rc=0; else rc=$?; fi

    if [[ $rc -eq 1 ]]; then _loop_action="skip"; _failed_step="$step_fn"; break; fi
    if [[ $rc -eq 2 ]]; then _loop_action="break"; _failed_step="$step_fn"; break; fi
  done

  case "$_loop_action" in
    break)
      # Record failure if we had a task in progress
      if [[ -n "${TASK_ISSUE:-}" ]]; then
        record_iteration_result "fail" "$_failed_step" "$TASK_ISSUE"
      fi
      break
      ;;
    skip)
      if [[ "$_skip_is_benign" == "true" ]]; then
        # Benign skip (e.g. issue already implemented) — not a failure
        record_iteration_result "success" "skip_benign" "${TASK_ISSUE:-}"
      else
        record_iteration_result "fail" "$_failed_step" "${TASK_ISSUE:-}"
        # If a self-review iteration failed, exit — can't self-heal
        if [[ "$_is_review_iteration" == "true" ]]; then
          log "FATAL: self-review タスク自体が失敗しました。ループを終了します。"
          break
        fi
      fi
      continue
      ;;
    next)
      record_iteration_result "success" "complete" "${TASK_ISSUE:-}"
      # Reset failure history after successful self-review to prevent re-triggering
      if [[ "$_is_review_iteration" == "true" ]]; then
        reset_failure_history
      fi
      ;;
  esac

  # ── Sleep before next iteration ──────────────────────────────────────────
  if [[ "$MAX_ITERATIONS" -gt 0 && "$iteration" -ge "$MAX_ITERATIONS" ]]; then
    log "Reached max iterations. Exiting."
    break
  fi

  log "Sleeping ${SLEEP_SECONDS}s before next iteration..."
  interruptible_sleep "$SLEEP_SECONDS"
done

log "=== Agent loop finished ==="
