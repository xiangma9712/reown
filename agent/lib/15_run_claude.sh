# agent/lib/15_run_claude.sh — Unified wrapper for all claude -p invocations
# Provides: timeout control, stdout/stderr log capture, rate limit detection.
#
# Usage:
#   run_claude [OPTIONS] -- "prompt text"
#
# Options:
#   --label NAME         Human-readable label for log files (required)
#   --timeout SECONDS    Process-level timeout (default: 300)
#   --max-turns N        --max-turns for claude (default: 20)
#   --max-budget USD     --max-budget-usd for claude (default: $MAX_BUDGET_USD)
#   --allowedTools T     --allowedTools for claude (required)
#   --output-format FMT  --output-format for claude (optional)
#
# Stdout: claude's stdout (passthrough)
# Return: 0=ok, 1=error, 2=rate limited, 124=timeout (hung)

run_claude() {
  local label="" timeout_sec=300 max_turns=20 budget="$MAX_BUDGET_USD"
  local allowed_tools="" output_format="" prompt=""

  # Parse options
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --label)         label="$2";         shift 2 ;;
      --timeout)       timeout_sec="$2";   shift 2 ;;
      --max-turns)     max_turns="$2";     shift 2 ;;
      --max-budget)    budget="$2";        shift 2 ;;
      --allowedTools)  allowed_tools="$2"; shift 2 ;;
      --output-format) output_format="$2"; shift 2 ;;
      --)              shift; prompt="$*"; break ;;
      *)               prompt="$*"; break ;;
    esac
  done

  if [[ -z "$label" ]]; then
    log "ERROR: run_claude called without --label"
    return 1
  fi
  if [[ -z "$prompt" ]]; then
    log "ERROR: run_claude called without prompt"
    return 1
  fi

  # ── Determine log file paths ──────────────────────────────────────────────
  local log_dir="${ITER_LOG_DIR:-/tmp/claude}"
  mkdir -p "$log_dir"

  local safe_label
  safe_label=$(echo "$label" | tr ' /' '_')
  local stdout_log="$log_dir/${safe_label}.stdout.log"
  local stderr_log="$log_dir/${safe_label}.stderr.log"

  # ── Build claude command ──────────────────────────────────────────────────
  local -a cmd=(claude -p "$prompt" --max-turns "$max_turns" --max-budget-usd "$budget")
  if [[ -n "$allowed_tools" ]]; then
    cmd+=(--allowedTools "$allowed_tools")
  fi
  if [[ -n "$output_format" ]]; then
    cmd+=(--output-format "$output_format")
  fi

  # ── Execute with timeout ──────────────────────────────────────────────────
  log "run_claude [$label] starting (timeout=${timeout_sec}s, max-turns=$max_turns, budget=$budget)"

  # Resolve timeout command: GNU timeout > gtimeout (Homebrew coreutils) > perl fallback
  local timeout_cmd=""
  if command -v timeout &>/dev/null; then
    timeout_cmd="timeout"
  elif command -v gtimeout &>/dev/null; then
    timeout_cmd="gtimeout"
  fi

  # Run in background + wait so that bash trap handlers fire immediately on
  # SIGINT/SIGTERM.  Foreground external commands (e.g. timeout/gtimeout) defer
  # trap execution until the command exits, which blocks graceful shutdown.
  local rc=0
  if [[ -n "$timeout_cmd" ]]; then
    "$timeout_cmd" --kill-after=10 "$timeout_sec" "${cmd[@]}" \
      </dev/null >"$stdout_log" 2>"$stderr_log" &
  else
    "${cmd[@]}" </dev/null >"$stdout_log" 2>"$stderr_log" &
  fi
  local pid=$!

  # macOS fallback: background watchdog for timeout (no-op when timeout cmd exists)
  local watchdog_pid=""
  if [[ -z "$timeout_cmd" ]]; then
    ( sleep "$timeout_sec" && kill -TERM "$pid" 2>/dev/null ) &
    watchdog_pid=$!
  fi

  # wait is a bash builtin — interruptible by signals (unlike foreground cmds)
  wait "$pid" 2>/dev/null || rc=$?

  # Clean up watchdog and detect timeout
  if [[ -n "$watchdog_pid" ]]; then
    if kill -0 "$watchdog_pid" 2>/dev/null; then
      # Watchdog still alive → process exited before timeout
      kill "$watchdog_pid" 2>/dev/null || true
      wait "$watchdog_pid" 2>/dev/null || true
    else
      # Watchdog already exited → timeout fired (unless killed by signal)
      if [[ "${STOP_REQUESTED:-false}" != "true" ]]; then
        rc=124
      fi
    fi
  fi

  # If graceful stop was requested while waiting, ensure child is terminated
  if [[ "${STOP_REQUESTED:-false}" == "true" ]] && kill -0 "$pid" 2>/dev/null; then
    log "run_claude [$label] terminating child (graceful stop)..."
    kill -TERM "$pid" 2>/dev/null
    wait "$pid" 2>/dev/null || true
  fi

  # ── Classify exit code ────────────────────────────────────────────────────
  if [[ "$rc" -eq 124 ]]; then
    log "ERROR: run_claude [$label] timed out after ${timeout_sec}s (hung process killed)"
    return 124
  fi

  # Rate limit check
  if check_rate_limit "$stderr_log"; then
    log "FATAL: run_claude [$label] hit rate limit"
    return 2
  fi

  if [[ "$rc" -ne 0 ]]; then
    log "WARN: run_claude [$label] exited with code $rc"
    log "  stderr (last 5 lines): $(tail -5 "$stderr_log" 2>/dev/null || echo '(empty)')"
  else
    log "run_claude [$label] completed successfully"
  fi

  # ── Emit stdout for callers that capture it ───────────────────────────────
  cat "$stdout_log"

  return "$rc"
}

# ── Helper: get stderr log path for the last run_claude call ────────────────
# Usage: local stderr_file=$(run_claude_stderr "label")
run_claude_stderr() {
  local label="$1"
  local safe_label
  safe_label=$(echo "$label" | tr ' /' '_')
  echo "${ITER_LOG_DIR:-/tmp/claude}/${safe_label}.stderr.log"
}

# ── Helper: get stdout log path for the last run_claude call ────────────────
run_claude_stdout() {
  local label="$1"
  local safe_label
  safe_label=$(echo "$label" | tr ' /' '_')
  echo "${ITER_LOG_DIR:-/tmp/claude}/${safe_label}.stdout.log"
}
