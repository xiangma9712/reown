pub mod branch;
pub mod diff;
pub mod worktree;

use anyhow::{Context, Result};
use git2::Repository;

/// Open the repository at or above `repo_path`.
///
/// This is the single entry point for `Repository::discover`, eliminating
/// the duplicated boilerplate across branch/diff/worktree modules.
pub fn open_repo(repo_path: &str) -> Result<Repository> {
    Repository::discover(repo_path)
        .with_context(|| format!("Failed to open repository at {repo_path}"))
}
