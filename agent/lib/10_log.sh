# agent/lib/10_log.sh — Logging helper with rotation

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
  echo "$msg"
  _rotate_log
  echo "$msg" >> "$_log_file"
}
