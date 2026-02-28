# agent/lib/35_cleanup.sh — Orphaned resource cleanup on startup
# Detects and cleans up GitHub issues with stale 'doing' label left by a
# previous loop.sh that was killed (SIGKILL / crash) without cleanup.

# ══════════════════════════════════════════════════════════════════════════════
# cleanup_orphaned_labels — find issues with 'doing' label and reset to 'planned'
# ══════════════════════════════════════════════════════════════════════════════
cleanup_orphaned_labels() {
  log "Checking for orphaned 'doing' labels on issues..."

  local issues
  issues=$(gh issue list --label "doing" --state open --json number,title --limit 50 2>/dev/null) || {
    log "  WARN: Could not fetch GitHub issues. Skipping orphan cleanup."
    return 0
  }

  local count
  count=$(echo "$issues" | jq 'length' 2>/dev/null) || count=0
  if [[ "$count" -eq 0 ]]; then
    log "  No orphaned issues found."
    return 0
  fi

  log "  Found $count issue(s) with stale 'doing' label."

  local i issue_number issue_title
  for (( i=0; i<count; i++ )); do
    issue_number=$(echo "$issues" | jq -r ".[$i].number")
    issue_title=$(echo "$issues" | jq -r ".[$i].title")

    log "  Resetting issue #$issue_number: $issue_title → planned"
    gh issue edit "$issue_number" --add-label "planned" --remove-label "doing" 2>/dev/null || true
  done
}

# ══════════════════════════════════════════════════════════════════════════════
# cleanup_orphaned_resources — main entry point, called from loop.sh
# ══════════════════════════════════════════════════════════════════════════════
cleanup_orphaned_resources() {
  log "=== Orphaned resource cleanup ==="
  cleanup_orphaned_labels
  log "=== Orphaned resource cleanup complete ==="
}
