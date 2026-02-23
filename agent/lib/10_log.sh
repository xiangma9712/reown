# agent/lib/10_log.sh — Logging helper

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg"
  echo "$msg" >> "$REPO_ROOT/progress.txt"
}
