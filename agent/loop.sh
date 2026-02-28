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
# Clear stale iteration logs from previous runs (avoids name collision with iter-001, etc.)
rm -rf "${AGENT_LOG_BASE:-/tmp/claude/agent-logs}"
mkdir -p "${AGENT_LOG_BASE:-/tmp/claude/agent-logs}"

# Ensure required labels exist on the repo
ensure_labels

# Clean up orphaned labels from previous crashed runs
cleanup_orphaned_resources

# ── Step execution order ─────────────────────────────────────────────────────
STEP_ORDER=(step_setup step_triage step_select step_implement step_verify step_reqverify step_review step_push step_ci step_complete)

# ── Main Loop ────────────────────────────────────────────────────────────────
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

  # ── Hot-reload: re-source lib & steps every iteration ────────────────────
  for f in "$SCRIPT_DIR"/lib/*.sh; do safe_source "$f"; done
  for f in "$SCRIPT_DIR"/steps/*.sh; do safe_source "$f"; done

  # ── Execute steps sequentially ───────────────────────────────────────────
  _loop_action="next"
  for step_fn in "${STEP_ORDER[@]}"; do
    if ! type -t "$step_fn" >/dev/null 2>&1; then
      log "FATAL: Step function '$step_fn' not defined."
      _loop_action="break"; break
    fi

    rc=0
    if "$step_fn"; then rc=0; else rc=$?; fi

    if [[ $rc -eq 1 ]]; then _loop_action="skip"; break; fi
    if [[ $rc -eq 2 ]]; then _loop_action="break"; break; fi
  done

  case "$_loop_action" in
    break) break ;;
    skip)  continue ;;
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
