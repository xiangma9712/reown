# agent/lib/20_rate_limit.sh — Rate limit detection
# Uses a flag file so it works across subshells (pipes).

RATE_LIMIT_FLAG="/tmp/claude/agent-rate-limited"

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
