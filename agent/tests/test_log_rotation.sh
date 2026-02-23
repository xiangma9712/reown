#!/usr/bin/env bash
# agent/tests/test_log_rotation.sh — Tests for log rotation
set -euo pipefail

FAILURES=0

fail() {
  echo "FAIL: $1"
  FAILURES=$((FAILURES + 1))
}

pass() {
  echo "PASS: $1"
}

# ── Setup temp dir as REPO_ROOT ─────────────────────────────────────────────
TMPDIR_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_ROOT"' EXIT
export REPO_ROOT="$TMPDIR_ROOT"

# Source config defaults, then the log library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_config.sh"
source "$SCRIPT_DIR/lib/10_log.sh"

# ── Test 1: log creates progress.txt ─────────────────────────────────────────
log "hello" > /dev/null
if [[ -f "$REPO_ROOT/progress.txt" ]]; then
  pass "log creates progress.txt"
else
  fail "log creates progress.txt"
fi

# ── Test 2: log appends to progress.txt ──────────────────────────────────────
log "world" > /dev/null
lines=$(wc -l < "$REPO_ROOT/progress.txt")
if [[ "$lines" -eq 2 ]]; then
  pass "log appends lines"
else
  fail "log appends lines (expected 2, got $lines)"
fi

# ── Test 3: no rotation when under limit ─────────────────────────────────────
if [[ ! -f "$REPO_ROOT/progress.txt.1" ]]; then
  pass "no rotation under limit"
else
  fail "no rotation under limit (found progress.txt.1)"
fi

# ── Test 4: rotation triggers when over limit ────────────────────────────────
rm -f "$REPO_ROOT"/progress.txt*
export LOG_MAX_BYTES=100
# Write enough data to exceed 100 bytes
for i in $(seq 1 5); do
  log "padding line $i with extra text to fill up the file quickly" > /dev/null
done
if [[ -f "$REPO_ROOT/progress.txt.1" ]]; then
  pass "rotation triggers on size limit"
else
  fail "rotation triggers on size limit (progress.txt.1 not found)"
fi

# ── Test 5: current progress.txt is small after rotation ─────────────────────
current_size=$(wc -c < "$REPO_ROOT/progress.txt")
if [[ "$current_size" -lt 100 ]]; then
  pass "current file is small after rotation"
else
  fail "current file is small after rotation (size=$current_size)"
fi

# ── Test 6: max archives respected ───────────────────────────────────────────
rm -f "$REPO_ROOT"/progress.txt*
export LOG_MAX_BYTES=50
export LOG_MAX_FILES=2
# Re-source to pick up new _log_file (REPO_ROOT didn't change, but ensure fresh state)
source "$SCRIPT_DIR/lib/10_log.sh"

for i in $(seq 1 30); do
  log "fill line $i with padding to trigger multiple rotations" > /dev/null
done

if [[ ! -f "$REPO_ROOT/progress.txt.3" ]]; then
  pass "max archives respected (no .3 with LOG_MAX_FILES=2)"
else
  fail "max archives respected (found progress.txt.3)"
fi

if [[ -f "$REPO_ROOT/progress.txt.1" ]]; then
  pass "archive .1 exists"
else
  fail "archive .1 exists"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [[ "$FAILURES" -eq 0 ]]; then
  echo "All tests passed."
  exit 0
else
  echo "$FAILURES test(s) failed."
  exit 1
fi
