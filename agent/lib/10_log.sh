# agent/lib/10_log.sh — Logging helper with rotation + iteration log directories

_log_file="$REPO_ROOT/progress.txt"

# Rotate progress.txt when it exceeds LOG_MAX_BYTES.
# Keeps up to LOG_MAX_FILES archived copies (.1, .2, …).
_rotate_log() {
  [[ -f "$_log_file" ]] || return 0
  local size
  size=$(wc -c < "$_log_file" 2>/dev/null || echo 0)
  if [[ "$size" -lt "${LOG_MAX_BYTES:-524288}" ]]; then
    return 0
  fi

  local max="${LOG_MAX_FILES:-3}"
  # Remove the oldest archive if it exists
  rm -f "${_log_file}.${max}"
  # Shift archives: .2 → .3, .1 → .2, etc.
  local i=$((max - 1))
  while [[ "$i" -ge 1 ]]; do
    if [[ -f "${_log_file}.${i}" ]]; then
      mv "${_log_file}.${i}" "${_log_file}.$((i + 1))"
    fi
    i=$((i - 1))
  done
  # Current → .1
  mv "$_log_file" "${_log_file}.1"
}

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg" >&2
  _rotate_log
  echo "$msg" >> "$_log_file"
}

# interruptible_sleep — sleep that responds immediately to SIGINT/SIGTERM.
# Foreground `sleep` defers bash trap execution until it exits. Running sleep
# in the background and using `wait` (a builtin) allows the trap handler to
# fire instantly, so Ctrl-C during iteration backoff works.
interruptible_sleep() {
  sleep "$1" &
  wait $! 2>/dev/null || true
}

# ── Iteration log directory management ──────────────────────────────────────
# ITER_LOG_DIR is set per iteration and used by run_claude for log output.
ITER_LOG_DIR=""

# init_iter_log_dir — create a fresh log directory for this iteration.
# Sets ITER_LOG_DIR and creates the "latest" symlink.
# Usage: init_iter_log_dir <iteration_number>
init_iter_log_dir() {
  local iter_num="$1"
  local base="${AGENT_LOG_BASE:-/tmp/claude/agent-logs}"
  local dir_name
  dir_name=$(printf "iter-%03d" "$iter_num")

  ITER_LOG_DIR="$base/$dir_name"
  mkdir -p "$ITER_LOG_DIR"

  # Update "latest" symlink
  local latest_link="$base/latest"
  rm -f "$latest_link"
  ln -sf "$dir_name" "$latest_link"

  log "Iteration log directory: $ITER_LOG_DIR"
}

# cleanup_old_iter_logs — remove iteration logs older than AGENT_LOG_KEEP.
# Keeps the most recent N directories by name sort.
# Skips cleanup entirely when recent failures exist (logs needed for self-review).
cleanup_old_iter_logs() {
  local base="${AGENT_LOG_BASE:-/tmp/claude/agent-logs}"
  local keep="${AGENT_LOG_KEEP:-5}"

  [[ -d "$base" ]] || return 0

  # Preserve all logs when recent failures exist — self-review needs them
  if [[ -f "$ITERATION_RESULTS_FILE" ]] \
     && tail -n 5 "$ITERATION_RESULTS_FILE" 2>/dev/null | grep -q ' fail '; then
    return 0
  fi

  local -a dirs=()
  local d
  while IFS= read -r d; do
    dirs+=("$d")
  done < <(find "$base" -maxdepth 1 -type d -name 'iter-*' | sort)

  local total=${#dirs[@]}
  if [[ "$total" -le "$keep" ]]; then
    return 0
  fi

  local to_remove=$((total - keep))
  local i
  for (( i=0; i<to_remove; i++ )); do
    log "Removing old iteration log: ${dirs[$i]}"
    rm -rf "${dirs[$i]}"
  done
}
