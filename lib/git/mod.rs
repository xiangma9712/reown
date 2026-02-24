pub mod branch;
pub mod diff;
#[cfg(test)]
pub mod test_utils;
pub mod worktree;

use anyhow::{Context, Result};
use git2::Repository;
use serde::Serialize;

/// Open the repository at or above `repo_path`.
///
/// This is the single entry point for `Repository::discover`, eliminating
/// the duplicated boilerplate across branch/diff/worktree modules.
pub fn open_repo(repo_path: &str) -> Result<Repository> {
    Repository::discover(repo_path)
        .with_context(|| format!("Failed to open repository at {repo_path}"))
}

/// リポジトリの基本情報
#[derive(Debug, Clone, Serialize)]
pub struct RepoInfo {
    /// リポジトリのルートパス
    pub path: String,
    /// リポジトリ名（ディレクトリ名）
    pub name: String,
    /// origin リモートの URL（存在する場合）
    pub remote_url: Option<String>,
    /// GitHub の owner（リモートURLからパースした場合）
    pub github_owner: Option<String>,
    /// GitHub の repo 名（リモートURLからパースした場合）
    pub github_repo: Option<String>,
}

/// リモートURLから GitHub の owner と repo をパースする
///
/// 対応フォーマット:
/// - HTTPS: `https://github.com/owner/repo.git` or `https://github.com/owner/repo`
/// - SSH: `git@github.com:owner/repo.git` or `git@github.com:owner/repo`
pub fn parse_github_remote(url: &str) -> Option<(String, String)> {
    // HTTPS format: https://github.com/owner/repo.git
    if let Some(rest) = url
        .strip_prefix("https://github.com/")
        .or_else(|| url.strip_prefix("http://github.com/"))
    {
        let rest = rest.trim_end_matches('/');
        let parts: Vec<&str> = rest.splitn(3, '/').collect();
        if parts.len() >= 2 && !parts[0].is_empty() && !parts[1].is_empty() {
            let owner = parts[0].to_string();
            let repo = parts[1].trim_end_matches(".git").to_string();
            return Some((owner, repo));
        }
    }

    // SSH format: git@github.com:owner/repo.git
    if let Some(rest) = url.strip_prefix("git@github.com:") {
        let rest = rest.trim_end_matches('/');
        let parts: Vec<&str> = rest.splitn(3, '/').collect();
        if parts.len() >= 2 && !parts[0].is_empty() && !parts[1].is_empty() {
            let owner = parts[0].to_string();
            let repo = parts[1].trim_end_matches(".git").to_string();
            return Some((owner, repo));
        }
    }

    None
}

/// 指定パスのリポジトリ情報を取得する
pub fn get_repo_info(repo_path: &str) -> Result<RepoInfo> {
    let repo = open_repo(repo_path)?;

    let workdir = repo
        .workdir()
        .with_context(|| "ベアリポジトリはサポートされていません")?;

    let path = workdir.to_string_lossy().to_string();
    let name = workdir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let remote_url = repo
        .find_remote("origin")
        .ok()
        .and_then(|r| r.url().map(|u| u.to_string()));

    let (github_owner, github_repo) = remote_url
        .as_deref()
        .and_then(parse_github_remote)
        .map(|(o, r)| (Some(o), Some(r)))
        .unwrap_or((None, None));

    Ok(RepoInfo {
        path,
        name,
        remote_url,
        github_owner,
        github_repo,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_github_remote_https() {
        let (owner, repo) = parse_github_remote("https://github.com/octocat/hello-world.git").unwrap();
        assert_eq!(owner, "octocat");
        assert_eq!(repo, "hello-world");
    }

    #[test]
    fn test_parse_github_remote_https_no_git_suffix() {
        let (owner, repo) = parse_github_remote("https://github.com/octocat/hello-world").unwrap();
        assert_eq!(owner, "octocat");
        assert_eq!(repo, "hello-world");
    }

    #[test]
    fn test_parse_github_remote_ssh() {
        let (owner, repo) = parse_github_remote("git@github.com:octocat/hello-world.git").unwrap();
        assert_eq!(owner, "octocat");
        assert_eq!(repo, "hello-world");
    }

    #[test]
    fn test_parse_github_remote_ssh_no_git_suffix() {
        let (owner, repo) = parse_github_remote("git@github.com:octocat/hello-world").unwrap();
        assert_eq!(owner, "octocat");
        assert_eq!(repo, "hello-world");
    }

    #[test]
    fn test_parse_github_remote_non_github() {
        assert!(parse_github_remote("https://gitlab.com/octocat/hello-world.git").is_none());
    }

    #[test]
    fn test_parse_github_remote_invalid() {
        assert!(parse_github_remote("not-a-url").is_none());
    }

    #[test]
    fn test_parse_github_remote_https_trailing_slash() {
        let (owner, repo) = parse_github_remote("https://github.com/octocat/hello-world/").unwrap();
        assert_eq!(owner, "octocat");
        assert_eq!(repo, "hello-world");
    }

    #[test]
    fn test_get_repo_info_basic() {
        let (dir, _repo) = test_utils::init_test_repo();
        let info = get_repo_info(dir.path().to_str().unwrap()).unwrap();
        assert!(!info.name.is_empty());
        assert!(!info.path.is_empty());
        assert!(info.remote_url.is_none());
        assert!(info.github_owner.is_none());
        assert!(info.github_repo.is_none());
    }

    #[test]
    fn test_get_repo_info_with_remote() {
        let (dir, repo) = test_utils::init_test_repo();
        repo.remote("origin", "https://github.com/testowner/testrepo.git")
            .unwrap();
        let info = get_repo_info(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(info.remote_url.as_deref(), Some("https://github.com/testowner/testrepo.git"));
        assert_eq!(info.github_owner.as_deref(), Some("testowner"));
        assert_eq!(info.github_repo.as_deref(), Some("testrepo"));
    }

    #[test]
    fn test_get_repo_info_invalid_path() {
        let result = get_repo_info("/nonexistent/path");
        assert!(result.is_err());
    }
}
