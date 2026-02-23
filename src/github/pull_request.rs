use anyhow::{Context, Result};
use serde::Deserialize;

/// Information about a GitHub pull request.
#[derive(Debug, Clone, serde::Serialize)]
pub struct PrInfo {
    pub number: u64,
    pub title: String,
    pub author: String,
    pub state: String,
    pub head_branch: String,
    pub updated_at: String,
    pub additions: u64,
    pub deletions: u64,
    pub changed_files: u64,
}

/// Raw GitHub API response for a pull request.
#[derive(Debug, Deserialize)]
struct GhPullRequest {
    number: u64,
    title: String,
    state: String,
    user: GhUser,
    head: GhHead,
    updated_at: String,
    merged_at: Option<String>,
    #[serde(default)]
    additions: u64,
    #[serde(default)]
    deletions: u64,
    #[serde(default)]
    changed_files: u64,
}

#[derive(Debug, Deserialize)]
struct GhUser {
    login: String,
}

#[derive(Debug, Deserialize)]
struct GhHead {
    #[serde(rename = "ref")]
    ref_name: String,
}

impl From<GhPullRequest> for PrInfo {
    fn from(pr: GhPullRequest) -> Self {
        let state = if pr.state == "closed" && pr.merged_at.is_some() {
            "merged".to_string()
        } else {
            pr.state
        };
        Self {
            number: pr.number,
            title: pr.title,
            author: pr.user.login,
            state,
            head_branch: pr.head.ref_name,
            updated_at: pr.updated_at,
            additions: pr.additions,
            deletions: pr.deletions,
            changed_files: pr.changed_files,
        }
    }
}

/// Fetch pull requests from a GitHub repository.
///
/// Calls `GET /repos/{owner}/{repo}/pulls` with `state=all` to include open, closed,
/// and merged PRs. The token should be a GitHub personal access token or similar.
pub fn list_pull_requests(owner: &str, repo: &str, token: &str) -> Result<Vec<PrInfo>> {
    let url = format!("https://api.github.com/repos/{owner}/{repo}/pulls?state=all&per_page=100");

    let client = reqwest::blocking::Client::new();
    let response = client
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "reown")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .with_context(|| format!("Failed to fetch PRs from {owner}/{repo}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        anyhow::bail!("GitHub API returned {status}: {body}");
    }

    let prs: Vec<GhPullRequest> = response
        .json()
        .context("Failed to parse GitHub PR response")?;

    Ok(prs.into_iter().map(PrInfo::from).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Test that a valid GitHub API JSON response deserializes correctly into PrInfo.
    #[test]
    fn test_parse_pr_response() {
        let json = r#"[
            {
                "number": 42,
                "title": "Add feature X",
                "state": "open",
                "user": { "login": "alice" },
                "head": { "ref": "feature-x" },
                "updated_at": "2025-01-15T10:30:00Z",
                "additions": 100,
                "deletions": 20,
                "changed_files": 5
            },
            {
                "number": 43,
                "title": "Fix bug Y",
                "state": "open",
                "user": { "login": "bob" },
                "head": { "ref": "fix-bug-y" },
                "updated_at": "2025-01-16T08:00:00Z",
                "additions": 10,
                "deletions": 3,
                "changed_files": 2
            }
        ]"#;

        let gh_prs: Vec<GhPullRequest> = serde_json::from_str(json).unwrap();
        let prs: Vec<PrInfo> = gh_prs.into_iter().map(PrInfo::from).collect();

        assert_eq!(prs.len(), 2);

        assert_eq!(prs[0].number, 42);
        assert_eq!(prs[0].title, "Add feature X");
        assert_eq!(prs[0].author, "alice");
        assert_eq!(prs[0].state, "open");
        assert_eq!(prs[0].head_branch, "feature-x");
        assert_eq!(prs[0].updated_at, "2025-01-15T10:30:00Z");
        assert_eq!(prs[0].additions, 100);
        assert_eq!(prs[0].deletions, 20);
        assert_eq!(prs[0].changed_files, 5);

        assert_eq!(prs[1].number, 43);
        assert_eq!(prs[1].title, "Fix bug Y");
        assert_eq!(prs[1].author, "bob");
        assert_eq!(prs[1].state, "open");
        assert_eq!(prs[1].head_branch, "fix-bug-y");
    }

    /// Test that missing optional numeric fields default to 0.
    #[test]
    fn test_parse_pr_missing_stats() {
        let json = r#"[
            {
                "number": 1,
                "title": "Minimal PR",
                "state": "open",
                "user": { "login": "dev" },
                "head": { "ref": "main" },
                "updated_at": "2025-02-01T00:00:00Z"
            }
        ]"#;

        let gh_prs: Vec<GhPullRequest> = serde_json::from_str(json).unwrap();
        let prs: Vec<PrInfo> = gh_prs.into_iter().map(PrInfo::from).collect();

        assert_eq!(prs.len(), 1);
        assert_eq!(prs[0].number, 1);
        assert_eq!(prs[0].additions, 0);
        assert_eq!(prs[0].deletions, 0);
        assert_eq!(prs[0].changed_files, 0);
    }

    /// Test parsing an empty response.
    #[test]
    fn test_parse_empty_pr_list() {
        let json = "[]";
        let gh_prs: Vec<GhPullRequest> = serde_json::from_str(json).unwrap();
        let prs: Vec<PrInfo> = gh_prs.into_iter().map(PrInfo::from).collect();
        assert!(prs.is_empty());
    }

    /// Test that a closed PR (without merged_at) state is preserved correctly.
    #[test]
    fn test_parse_closed_pr() {
        let json = r#"[
            {
                "number": 99,
                "title": "Old PR",
                "state": "closed",
                "user": { "login": "charlie" },
                "head": { "ref": "old-branch" },
                "updated_at": "2024-12-01T12:00:00Z",
                "merged_at": null,
                "additions": 50,
                "deletions": 50,
                "changed_files": 10
            }
        ]"#;

        let gh_prs: Vec<GhPullRequest> = serde_json::from_str(json).unwrap();
        let prs: Vec<PrInfo> = gh_prs.into_iter().map(PrInfo::from).collect();

        assert_eq!(prs[0].state, "closed");
        assert_eq!(prs[0].author, "charlie");
        assert_eq!(prs[0].head_branch, "old-branch");
    }

    /// Test that a merged PR (closed + merged_at) is mapped to state "merged".
    #[test]
    fn test_parse_merged_pr() {
        let json = r#"[
            {
                "number": 50,
                "title": "Merged feature",
                "state": "closed",
                "user": { "login": "dave" },
                "head": { "ref": "merged-branch" },
                "updated_at": "2025-01-20T14:00:00Z",
                "merged_at": "2025-01-20T13:55:00Z",
                "additions": 30,
                "deletions": 5,
                "changed_files": 3
            }
        ]"#;

        let gh_prs: Vec<GhPullRequest> = serde_json::from_str(json).unwrap();
        let prs: Vec<PrInfo> = gh_prs.into_iter().map(PrInfo::from).collect();

        assert_eq!(prs[0].number, 50);
        assert_eq!(prs[0].state, "merged");
        assert_eq!(prs[0].author, "dave");
        assert_eq!(prs[0].head_branch, "merged-branch");
    }

    /// Test that merged_at field is optional and defaults to None when absent.
    #[test]
    fn test_parse_pr_without_merged_at_field() {
        let json = r#"[
            {
                "number": 60,
                "title": "No merged_at field",
                "state": "open",
                "user": { "login": "eve" },
                "head": { "ref": "some-branch" },
                "updated_at": "2025-02-01T00:00:00Z"
            }
        ]"#;

        let gh_prs: Vec<GhPullRequest> = serde_json::from_str(json).unwrap();
        let prs: Vec<PrInfo> = gh_prs.into_iter().map(PrInfo::from).collect();

        assert_eq!(prs[0].state, "open");
    }

    /// Test mixed list of open, closed, and merged PRs.
    #[test]
    fn test_parse_mixed_pr_states() {
        let json = r#"[
            {
                "number": 1,
                "title": "Open PR",
                "state": "open",
                "user": { "login": "a" },
                "head": { "ref": "open-branch" },
                "updated_at": "2025-01-01T00:00:00Z",
                "merged_at": null
            },
            {
                "number": 2,
                "title": "Closed PR",
                "state": "closed",
                "user": { "login": "b" },
                "head": { "ref": "closed-branch" },
                "updated_at": "2025-01-02T00:00:00Z",
                "merged_at": null
            },
            {
                "number": 3,
                "title": "Merged PR",
                "state": "closed",
                "user": { "login": "c" },
                "head": { "ref": "merged-branch" },
                "updated_at": "2025-01-03T00:00:00Z",
                "merged_at": "2025-01-03T00:00:00Z"
            }
        ]"#;

        let gh_prs: Vec<GhPullRequest> = serde_json::from_str(json).unwrap();
        let prs: Vec<PrInfo> = gh_prs.into_iter().map(PrInfo::from).collect();

        assert_eq!(prs[0].state, "open");
        assert_eq!(prs[1].state, "closed");
        assert_eq!(prs[2].state, "merged");
    }
}
