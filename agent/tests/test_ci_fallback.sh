#!/usr/bin/env bash
# agent/tests/test_ci_fallback.sh — Tests for CI fix fallback commit logic
# Tests commit_with_formatter_retry() from lib/30_git.sh
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
export REPO_ROOT="$TMPDIR_ROOT/repo"

# Init a git repo with an initial commit + main branch
mkdir -p "$REPO_ROOT"
cd "$REPO_ROOT"
git init -b main
git config user.email "test@test.com"
git config user.name "Test"
echo "initial" > file.txt
git add file.txt
git commit -m "initial commit"

# Source config defaults, then libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_config.sh"
source "$SCRIPT_DIR/lib/10_log.sh"
source "$SCRIPT_DIR/lib/30_git.sh"

# Stub out cargo/npx so formatters don't actually run (they would fail in test env)
cargo() { return 0; }
npx() { return 0; }
export -f cargo npx

# ── Test 1: No uncommitted changes — nothing to do ──────────────────────────
cd "$REPO_ROOT"
commit_with_formatter_retry "test: should not create a commit"
commit_count=$(git rev-list --count HEAD)
if [[ "$commit_count" -eq 1 ]]; then
  pass "no commit when working tree is clean"
else
  fail "no commit when working tree is clean (expected 1 commit, got $commit_count)"
fi

# ── Test 2: Modified tracked file — commits successfully ─────────────────────
cd "$REPO_ROOT"
echo "modified" > file.txt
commit_with_formatter_retry "test: commit modified file"
commit_count=$(git rev-list --count HEAD)
if [[ "$commit_count" -eq 2 ]]; then
  pass "modified tracked file committed"
else
  fail "modified tracked file committed (expected 2 commits, got $commit_count)"
fi

# Verify commit message
last_msg=$(git log -1 --format="%s")
if [[ "$last_msg" == "test: commit modified file" ]]; then
  pass "commit message is correct"
else
  fail "commit message is correct (expected 'test: commit modified file', got '$last_msg')"
fi

# ── Test 3: New untracked source file — staged and committed ────────────────
cd "$REPO_ROOT"
echo "new content" > new_file.rs
commit_with_formatter_retry "test: commit new file"
commit_count=$(git rev-list --count HEAD)
if [[ "$commit_count" -eq 3 ]]; then
  pass "new untracked source file committed"
else
  fail "new untracked source file committed (expected 3 commits, got $commit_count)"
fi

# Verify the file is tracked
if git ls-files --error-unmatch new_file.rs >/dev/null 2>&1; then
  pass "new_file.rs is now tracked"
else
  fail "new_file.rs is now tracked"
fi

# ── Test 4: Non-source file is NOT staged by git_add_safe ────────────────────
cd "$REPO_ROOT"
echo "log data" > debug.log
commit_with_formatter_retry "test: should not commit log file"
if ! git ls-files --error-unmatch debug.log >/dev/null 2>&1; then
  pass "non-source file (.log) not staged"
else
  fail "non-source file (.log) not staged (debug.log was committed)"
fi
rm -f debug.log

# ── Test 5: Pre-commit hook failure — formatters re-run and retry succeeds ──
cd "$REPO_ROOT"

# Install a pre-commit hook that fails on first run, succeeds on second
mkdir -p .git/hooks
HOOK_MARKER="$(mktemp /tmp/test_ci_fallback_hook_marker.XXXXXX)"
rm -f "$HOOK_MARKER"  # remove so first check sees it missing
cat > .git/hooks/pre-commit << HOOK
#!/usr/bin/env bash
# Fail once, then succeed — simulates formatter fixing issues
MARKER="$HOOK_MARKER"
if [[ ! -f "\$MARKER" ]]; then
  touch "\$MARKER"
  exit 1
fi
rm -f "\$MARKER"
exit 0
HOOK
chmod +x .git/hooks/pre-commit

echo "needs formatting" > file.txt
commit_before=$(git rev-list --count HEAD)
commit_with_formatter_retry "test: commit after hook retry"
commit_after=$(git rev-list --count HEAD)

if [[ "$commit_after" -eq $((commit_before + 1)) ]]; then
  pass "commit succeeds after pre-commit hook retry"
else
  fail "commit succeeds after pre-commit hook retry (before=$commit_before, after=$commit_after)"
fi

# Verify working tree is clean
if git diff --quiet && git diff --cached --quiet; then
  pass "working tree is clean after hook retry"
else
  fail "working tree is clean after hook retry"
fi

# Clean up hook and marker
rm -f .git/hooks/pre-commit "$HOOK_MARKER"

# ── Test 6: Staged changes (--cached) are also detected ─────────────────────
cd "$REPO_ROOT"
echo "staged content" > file.txt
git add file.txt
commit_before=$(git rev-list --count HEAD)
commit_with_formatter_retry "test: commit staged changes"
commit_after=$(git rev-list --count HEAD)

if [[ "$commit_after" -eq $((commit_before + 1)) ]]; then
  pass "staged-only changes are committed"
else
  fail "staged-only changes are committed (before=$commit_before, after=$commit_after)"
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
