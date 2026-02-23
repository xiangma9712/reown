use anyhow::{Context, Result};
use git2::BranchType;

use super::open_repo;

#[derive(Debug, Clone, serde::Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub upstream: Option<String>,
}

/// List all local branches for the repository at `repo_path`.
pub fn list_branches(repo_path: &str) -> Result<Vec<BranchInfo>> {
    let repo = open_repo(repo_path)?;

    let mut branches = Vec::new();
    for branch_result in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = branch_result?;
        let name = branch
            .name()?
            .unwrap_or("<invalid utf-8>")
            .to_string();
        let is_head = branch.is_head();
        let upstream = branch
            .upstream()
            .ok()
            .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()));

        branches.push(BranchInfo { name, is_head, upstream });
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

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Repository;
    use tempfile::TempDir;

    fn init_test_repo() -> (TempDir, Repository) {
        let dir = TempDir::new().unwrap();
        let repo = Repository::init(dir.path()).unwrap();

        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test").unwrap();
        config.set_str("user.email", "test@test.com").unwrap();
        drop(config);

        let sig = git2::Signature::now("Test", "test@test.com").unwrap();
        let tree_id = {
            let mut index = repo.index().unwrap();
            index.write_tree().unwrap()
        };
        {
            let tree = repo.find_tree(tree_id).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
                .unwrap();
        }

        (dir, repo)
    }

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
}
