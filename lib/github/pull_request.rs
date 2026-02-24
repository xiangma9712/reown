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
    pub base_branch: String,
    pub updated_at: String,
    pub additions: u64,
    pub deletions: u64,
    pub changed_files: u64,
    pub body: String,
    pub html_url: String,
}

/// Raw GitHub API response for a pull request.
#[derive(Debug, Deserialize)]
struct GhPullRequest {
    number: u64,
    title: String,
    state: String,
    user: GhUser,
    head: GhHead,
    base: GhBase,
    updated_at: String,
    merged_at: Option<String>,
    #[serde(default)]
    additions: u64,
    #[serde(default)]
    deletions: u64,
    #[serde(default)]
    changed_files: u64,
    #[serde(default)]
    body: Option<String>,
    html_url: String,
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

#[derive(Debug, Deserialize)]
struct GhBase {
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
            base_branch: pr.base.ref_name,
            updated_at: pr.updated_at,
            additions: pr.additions,
            deletions: pr.deletions,
            changed_files: pr.changed_files,
            body: pr.body.unwrap_or_default(),
            html_url: pr.html_url,
        }
    }
}

/// Maximum number of pages to fetch to prevent infinite loops.
const MAX_PAGES: u32 = 10;

/// Parse the `Link` header to check if a `rel="next"` link exists.
fn has_next_page(link_header: &str) -> bool {
    link_header
        .split(',')
        .any(|part| part.contains("rel=\"next\""))
}

/// Fetch pull requests from a GitHub repository.
///
/// Calls `GET /repos/{owner}/{repo}/pulls` with `state=all` to include open, closed,
/// and merged PRs. Automatically paginates through all pages (up to `MAX_PAGES`).
/// The token should be a GitHub personal access token or similar.
pub async fn list_pull_requests(owner: &str, repo: &str, token: &str) -> Result<Vec<PrInfo>> {
    let client = reqwest::Client::new();
    let mut all_prs = Vec::new();

    for page in 1..=MAX_PAGES {
        let url = format!(
            "https://api.github.com/repos/{owner}/{repo}/pulls?state=all&per_page=100&page={page}"
        );

        let response = client
            .get(&url)
            .header("Accept", "application/vnd.github+json")
            .header("Authorization", format!("Bearer {token}"))
            .header("User-Agent", "reown")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .with_context(|| format!("Failed to fetch PRs from {owner}/{repo} (page {page})"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("GitHub API returned {status}: {body}");
        }

        let has_next = response
            .headers()
            .get("link")
            .and_then(|v| v.to_str().ok())
            .is_some_and(has_next_page);

        let prs: Vec<GhPullRequest> = response
            .json()
            .await
            .context("Failed to parse GitHub PR response")?;

        let is_empty = prs.is_empty();
        all_prs.extend(prs.into_iter().map(PrInfo::from));

        if is_empty || !has_next {
            break;
        }
    }

    Ok(all_prs)
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
                "base": { "ref": "main" },
                "updated_at": "2025-01-15T10:30:00Z",
                "additions": 100,
                "deletions": 20,
                "changed_files": 5,
                "body": "This PR adds feature X",
                "html_url": "https://github.com/owner/repo/pull/42"
            },
            {
                "number": 43,
                "title": "Fix bug Y",
                "state": "open",
                "user": { "login": "bob" },
                "head": { "ref": "fix-bug-y" },
                "base": { "ref": "develop" },
                "updated_at": "2025-01-16T08:00:00Z",
                "additions": 10,
                "deletions": 3,
                "changed_files": 2,
                "body": null,
                "html_url": "https://github.com/owner/repo/pull/43"
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
        assert_eq!(prs[0].base_branch, "main");
        assert_eq!(prs[0].updated_at, "2025-01-15T10:30:00Z");
        assert_eq!(prs[0].additions, 100);
        assert_eq!(prs[0].deletions, 20);
        assert_eq!(prs[0].changed_files, 5);
        assert_eq!(prs[0].body, "This PR adds feature X");
        assert_eq!(prs[0].html_url, "https://github.com/owner/repo/pull/42");

        assert_eq!(prs[1].number, 43);
        assert_eq!(prs[1].title, "Fix bug Y");
        assert_eq!(prs[1].author, "bob");
        assert_eq!(prs[1].state, "open");
        assert_eq!(prs[1].head_branch, "fix-bug-y");
        assert_eq!(prs[1].base_branch, "develop");
        assert_eq!(prs[1].body, "");
        assert_eq!(prs[1].html_url, "https://github.com/owner/repo/pull/43");
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
                "base": { "ref": "main" },
                "updated_at": "2025-02-01T00:00:00Z",
                "html_url": "https://github.com/owner/repo/pull/1"
            }
        ]"#;

        let gh_prs: Vec<GhPullRequest> = serde_json::from_str(json).unwrap();
        let prs: Vec<PrInfo> = gh_prs.into_iter().map(PrInfo::from).collect();

        assert_eq!(prs.len(), 1);
        assert_eq!(prs[0].number, 1);
        assert_eq!(prs[0].additions, 0);
        assert_eq!(prs[0].deletions, 0);
        assert_eq!(prs[0].changed_files, 0);
        assert_eq!(prs[0].body, "");
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
                "base": { "ref": "main" },
                "updated_at": "2024-12-01T12:00:00Z",
                "merged_at": null,
                "additions": 50,
                "deletions": 50,
                "changed_files": 10,
                "html_url": "https://github.com/owner/repo/pull/99"
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
                "base": { "ref": "main" },
                "updated_at": "2025-01-20T14:00:00Z",
                "merged_at": "2025-01-20T13:55:00Z",
                "additions": 30,
                "deletions": 5,
                "changed_files": 3,
                "body": "Merged feature description",
                "html_url": "https://github.com/owner/repo/pull/50"
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
                "base": { "ref": "main" },
                "updated_at": "2025-02-01T00:00:00Z",
                "html_url": "https://github.com/owner/repo/pull/60"
            }
        ]"#;

        let gh_prs: Vec<GhPullRequest> = serde_json::from_str(json).unwrap();
        let prs: Vec<PrInfo> = gh_prs.into_iter().map(PrInfo::from).collect();

        assert_eq!(prs[0].state, "open");
    }

    /// Test that has_next_page detects rel="next" in Link header.
    #[test]
    fn test_has_next_page_with_next_link() {
        let link = r#"<https://api.github.com/repos/owner/repo/pulls?page=2>; rel="next", <https://api.github.com/repos/owner/repo/pulls?page=5>; rel="last""#;
        assert!(has_next_page(link));
    }

    /// Test that has_next_page returns false when no next link exists.
    #[test]
    fn test_has_next_page_without_next_link() {
        let link = r#"<https://api.github.com/repos/owner/repo/pulls?page=1>; rel="prev", <https://api.github.com/repos/owner/repo/pulls?page=5>; rel="last""#;
        assert!(!has_next_page(link));
    }

    /// Test that has_next_page returns false for empty string.
    #[test]
    fn test_has_next_page_empty() {
        assert!(!has_next_page(""));
    }

    /// Test that has_next_page works with only a next link.
    #[test]
    fn test_has_next_page_only_next() {
        let link = r#"<https://api.github.com/repos/owner/repo/pulls?page=2>; rel="next""#;
        assert!(has_next_page(link));
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
                "base": { "ref": "main" },
                "updated_at": "2025-01-01T00:00:00Z",
                "merged_at": null,
                "html_url": "https://github.com/owner/repo/pull/1"
            },
            {
                "number": 2,
                "title": "Closed PR",
                "state": "closed",
                "user": { "login": "b" },
                "head": { "ref": "closed-branch" },
                "base": { "ref": "main" },
                "updated_at": "2025-01-02T00:00:00Z",
                "merged_at": null,
                "html_url": "https://github.com/owner/repo/pull/2"
            },
            {
                "number": 3,
                "title": "Merged PR",
                "state": "closed",
                "user": { "login": "c" },
                "head": { "ref": "merged-branch" },
                "base": { "ref": "develop" },
                "updated_at": "2025-01-03T00:00:00Z",
                "merged_at": "2025-01-03T00:00:00Z",
                "html_url": "https://github.com/owner/repo/pull/3"
            }
        ]"#;

        let gh_prs: Vec<GhPullRequest> = serde_json::from_str(json).unwrap();
        let prs: Vec<PrInfo> = gh_prs.into_iter().map(PrInfo::from).collect();

        assert_eq!(prs[0].state, "open");
        assert_eq!(prs[1].state, "closed");
        assert_eq!(prs[2].state, "merged");
    }
}
