use anyhow::{Context, Result};
use git2::{Repository, Worktree};
use std::path::PathBuf;

use super::open_repo;

#[derive(Debug, Clone, serde::Serialize)]
pub struct WorktreeInfo {
    pub name: String,
    pub path: PathBuf,
    pub branch: Option<String>,
    #[allow(dead_code)] // used in Phase 2 for worktree filtering
    pub is_main: bool,
    pub is_locked: bool,
}

/// List all worktrees for the given repository path.
pub fn list_worktrees(repo_path: &str) -> Result<Vec<WorktreeInfo>> {
    let repo = open_repo(repo_path)?;

    let mut result = Vec::new();

    // Main worktree
    let main_path = repo
        .workdir()
        .unwrap_or_else(|| repo.path())
        .to_path_buf();

    let main_branch = current_branch_name(&repo);
    result.push(WorktreeInfo {
        name: "(main)".to_string(),
        path: main_path,
        branch: main_branch,
        is_main: true,
        is_locked: false,
    });

    // Linked worktrees
    let names = repo.worktrees()?;
    for name in names.iter().flatten() {
        let wt: Worktree = repo.find_worktree(name)?;
        let wt_path = PathBuf::from(wt.path());

        let branch = worktree_branch(&wt_path);
        let is_locked = matches!(wt.is_locked(), Ok(git2::WorktreeLockStatus::Locked(_)));

        result.push(WorktreeInfo {
            name: name.to_string(),
            path: wt_path,
            branch,
            is_main: false,
            is_locked,
        });
    }

    Ok(result)
}

/// Add a new worktree at `path` checked out to `branch` (creates branch if
/// it doesn't exist).
pub fn add_worktree(repo_path: &str, worktree_path: &str, branch: &str) -> Result<()> {
    let repo = open_repo(repo_path)?;

    let path = std::path::Path::new(worktree_path);

    // Build AddOptions – check out an existing branch or create a new one.
    let mut opts = git2::WorktreeAddOptions::new();

    if let Ok(reference) = repo.find_branch(branch, git2::BranchType::Local) {
        opts.reference(Some(reference.get()));
        repo.worktree(branch, path, Some(&opts))
            .with_context(|| format!("Failed to add worktree '{branch}' at '{worktree_path}'"))?;
    } else {
        // Create the branch from HEAD, then check it out.
        let head = repo.head()?.peel_to_commit()?;
        let new_branch = repo.branch(branch, &head, false)?;
        opts.reference(Some(new_branch.get()));
        repo.worktree(branch, path, Some(&opts))
            .with_context(|| format!("Failed to add worktree '{branch}' at '{worktree_path}'"))?;
    }

    Ok(())
}

// ── helpers ──────────────────────────────────────────────────────────────────

fn current_branch_name(repo: &Repository) -> Option<String> {
    repo.head()
        .ok()
        .and_then(|r| r.shorthand().map(|s| s.to_string()))
}

fn worktree_branch(wt_path: &PathBuf) -> Option<String> {
    Repository::open(wt_path)
        .ok()
        .and_then(|r| current_branch_name(&r))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_utils::init_test_repo;

    #[test]
    fn test_list_worktrees_main_only() {
        let (dir, _repo) = init_test_repo();
        let wts = list_worktrees(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(wts.len(), 1);
        assert!(wts[0].is_main);
        assert_eq!(wts[0].name, "(main)");
    }

    #[test]
    fn test_add_worktree_creates_new_branch() {
        let (dir, _repo) = init_test_repo();
        let repo_path = dir.path().to_str().unwrap();

        let wt_path = dir.path().join("wt-feature");
        add_worktree(repo_path, wt_path.to_str().unwrap(), "feature").unwrap();

        let wts = list_worktrees(repo_path).unwrap();
        assert_eq!(wts.len(), 2);
        let added = wts.iter().find(|w| w.name == "feature").unwrap();
        assert!(!added.is_main);
        assert_eq!(added.branch.as_deref(), Some("feature"));
    }

    #[test]
    fn test_list_worktrees_invalid_path() {
        let result = list_worktrees("/tmp/nonexistent-repo-xyz");
        assert!(result.is_err());
    }
}
