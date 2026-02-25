use anyhow::{Context, Result};
use git2::BranchType;
use std::path::PathBuf;

use super::open_repo;
use super::worktree::list_worktrees;
use crate::github::PrInfo;

#[derive(Debug, Clone, serde::Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub upstream: Option<String>,
}

/// ブランチの状態情報を統合した型。
/// ローカルブランチ・リモートブランチ・worktree・PR の情報をまとめて持つ。
#[derive(Debug, Clone, serde::Serialize)]
pub struct EnrichedBranchInfo {
    pub name: String,
    pub is_head: bool,
    pub upstream: Option<String>,
    pub is_local: bool,
    pub is_remote: bool,
    pub has_worktree: bool,
    pub worktree_path: Option<PathBuf>,
    pub pr_number: Option<u64>,
    pub pr_title: Option<String>,
}

/// List all local branches for the repository at `repo_path`.
pub fn list_branches(repo_path: &str) -> Result<Vec<BranchInfo>> {
    let repo = open_repo(repo_path)?;

    let mut branches = Vec::new();
    for branch_result in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = branch_result?;
        let name = branch.name()?.unwrap_or("<invalid utf-8>").to_string();
        let is_head = branch.is_head();
        let upstream = branch
            .upstream()
            .ok()
            .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()));

        branches.push(BranchInfo {
            name,
            is_head,
            upstream,
        });
    }

    Ok(branches)
}

/// Create a new local branch from HEAD.
pub fn create_branch(repo_path: &str, name: &str) -> Result<()> {
    let repo = open_repo(repo_path)?;

    let head_commit = repo
        .head()?
        .peel_to_commit()
        .context("Failed to resolve HEAD to a commit")?;

    repo.branch(name, &head_commit, false)
        .with_context(|| format!("Failed to create branch '{name}'"))?;

    Ok(())
}

/// Switch (checkout) to an existing local branch.
pub fn switch_branch(repo_path: &str, name: &str) -> Result<()> {
    let repo = open_repo(repo_path)?;

    let branch = repo
        .find_branch(name, BranchType::Local)
        .with_context(|| format!("Branch '{name}' not found"))?;

    let refname = branch
        .get()
        .name()
        .context("Invalid branch reference name")?;

    repo.set_head(refname)
        .with_context(|| format!("Failed to set HEAD to '{name}'"))?;

    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().safe()))
        .with_context(|| format!("Failed to checkout '{name}'"))?;

    Ok(())
}

/// Delete a local branch. Refuses to delete the currently checked-out branch.
pub fn delete_branch(repo_path: &str, name: &str) -> Result<()> {
    let repo = open_repo(repo_path)?;

    let mut branch = repo
        .find_branch(name, BranchType::Local)
        .with_context(|| format!("Branch '{name}' not found"))?;

    if branch.is_head() {
        anyhow::bail!("Cannot delete the currently checked-out branch '{name}'");
    }

    branch
        .delete()
        .with_context(|| format!("Failed to delete branch '{name}'"))?;

    Ok(())
}

/// `list_branches`、`list_worktrees`、PR情報をマージして
/// 各ブランチの統合状態情報を返す。
pub fn list_enriched_branches(
    repo_path: &str,
    pull_requests: &[PrInfo],
) -> Result<Vec<EnrichedBranchInfo>> {
    let branches = list_branches(repo_path)?;
    let worktrees = list_worktrees(repo_path)?;

    let repo = open_repo(repo_path)?;

    // リモートブランチ名を収集
    let mut remote_branch_names = std::collections::HashSet::new();
    if let Ok(remote_branches) = repo.branches(Some(BranchType::Remote)) {
        for (branch, _) in remote_branches.flatten() {
            if let Ok(Some(name)) = branch.name() {
                // "origin/feature" → "feature"
                if let Some(short) = name.split('/').nth(1) {
                    remote_branch_names.insert(short.to_string());
                }
            }
        }
    }

    let enriched = branches
        .into_iter()
        .map(|b| {
            // worktree のマッチング: worktree の branch 名と一致するか
            let wt = worktrees
                .iter()
                .find(|w| w.branch.as_deref() == Some(&b.name));

            // PR のマッチング: head_branch がブランチ名と一致する open な PR
            let pr = pull_requests
                .iter()
                .find(|p| p.head_branch == b.name && p.state == "open");

            EnrichedBranchInfo {
                is_local: true,
                is_remote: remote_branch_names.contains(&b.name),
                has_worktree: wt.is_some(),
                worktree_path: wt.map(|w| w.path.clone()),
                pr_number: pr.map(|p| p.number),
                pr_title: pr.map(|p| p.title.clone()),
                name: b.name,
                is_head: b.is_head,
                upstream: b.upstream,
            }
        })
        .collect();

    Ok(enriched)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_utils::init_test_repo;

    #[test]
    fn test_list_branches_single_branch() {
        let (dir, _) = init_test_repo();
        let branches = list_branches(dir.path().to_str().unwrap()).unwrap();
        // After `git init` + first commit, there should be exactly one branch.
        assert_eq!(branches.len(), 1);
        assert!(branches[0].is_head);
    }

    #[test]
    fn test_create_branch() {
        let (dir, _) = init_test_repo();
        let path = dir.path().to_str().unwrap();
        create_branch(path, "feature").unwrap();
        let branches = list_branches(path).unwrap();
        assert!(branches.iter().any(|b| b.name == "feature"));
    }

    #[test]
    fn test_delete_branch() {
        let (dir, _) = init_test_repo();
        let path = dir.path().to_str().unwrap();
        create_branch(path, "to-delete").unwrap();
        delete_branch(path, "to-delete").unwrap();
        let branches = list_branches(path).unwrap();
        assert!(!branches.iter().any(|b| b.name == "to-delete"));
    }

    #[test]
    fn test_delete_checked_out_branch_fails() {
        let (dir, repo) = init_test_repo();
        let path = dir.path().to_str().unwrap();
        let head_branch = repo.head().unwrap();
        let head_name = head_branch.shorthand().unwrap().to_string();
        let result = delete_branch(path, &head_name);
        assert!(result.is_err());
    }

    #[test]
    fn test_switch_branch() {
        let (dir, _) = init_test_repo();
        let path = dir.path().to_str().unwrap();
        create_branch(path, "feature").unwrap();
        switch_branch(path, "feature").unwrap();
        let branches = list_branches(path).unwrap();
        let feature = branches.iter().find(|b| b.name == "feature").unwrap();
        assert!(feature.is_head);
    }

    #[test]
    fn test_list_enriched_branches_no_prs() {
        let (dir, _) = init_test_repo();
        let path = dir.path().to_str().unwrap();
        create_branch(path, "feature").unwrap();

        let enriched = list_enriched_branches(path, &[]).unwrap();
        assert_eq!(enriched.len(), 2);

        for b in &enriched {
            assert!(b.is_local);
            assert!(!b.is_remote);
            assert!(!b.has_worktree || b.is_head); // HEAD ブランチは main worktree にマッチする
            assert!(b.pr_number.is_none());
            assert!(b.pr_title.is_none());
        }
    }

    #[test]
    fn test_list_enriched_branches_with_worktree() {
        let (dir, _) = init_test_repo();
        let path = dir.path().to_str().unwrap();

        let wt_path = dir.path().join("wt-feature");
        crate::git::worktree::add_worktree(path, wt_path.to_str().unwrap(), "feature").unwrap();

        let enriched = list_enriched_branches(path, &[]).unwrap();
        let feature = enriched.iter().find(|b| b.name == "feature").unwrap();
        assert!(feature.has_worktree);
        assert!(feature.worktree_path.is_some());
    }

    #[test]
    fn test_list_enriched_branches_with_pr() {
        let (dir, _) = init_test_repo();
        let path = dir.path().to_str().unwrap();
        create_branch(path, "feature-x").unwrap();

        let prs = vec![PrInfo {
            number: 42,
            title: "Add feature X".to_string(),
            author: "alice".to_string(),
            state: "open".to_string(),
            head_branch: "feature-x".to_string(),
            base_branch: "main".to_string(),
            updated_at: "2025-01-15T10:30:00Z".to_string(),
            additions: 10,
            deletions: 2,
            changed_files: 1,
            body: String::new(),
            html_url: "https://github.com/owner/repo/pull/42".to_string(),
        }];

        let enriched = list_enriched_branches(path, &prs).unwrap();
        let feature = enriched.iter().find(|b| b.name == "feature-x").unwrap();
        assert_eq!(feature.pr_number, Some(42));
        assert_eq!(feature.pr_title.as_deref(), Some("Add feature X"));
    }

    #[test]
    fn test_list_enriched_branches_closed_pr_not_matched() {
        let (dir, _) = init_test_repo();
        let path = dir.path().to_str().unwrap();
        create_branch(path, "old-branch").unwrap();

        let prs = vec![PrInfo {
            number: 99,
            title: "Old PR".to_string(),
            author: "bob".to_string(),
            state: "closed".to_string(),
            head_branch: "old-branch".to_string(),
            base_branch: "main".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
            additions: 0,
            deletions: 0,
            changed_files: 0,
            body: String::new(),
            html_url: "https://github.com/owner/repo/pull/99".to_string(),
        }];

        let enriched = list_enriched_branches(path, &prs).unwrap();
        let branch = enriched.iter().find(|b| b.name == "old-branch").unwrap();
        assert!(branch.pr_number.is_none());
    }
}
