use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use crate::git::diff::{DiffChunk, DiffLineInfo, FileDiff, FileStatus, LineOrigin};

/// GitHub API クライアント。内部で `reqwest::Client` を共有し、接続プールを再利用する。
#[derive(Clone)]
pub struct GitHubClient {
    http: reqwest::Client,
}

/// Merge method for auto-merge.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MergeMethod {
    Merge,
    Squash,
    Rebase,
}

/// Review event type for PR review submission.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ReviewEvent {
    Approve,
    RequestChanges,
}

/// Request body for submitting a PR review.
#[derive(Debug, Serialize)]
struct SubmitReviewRequest {
    event: ReviewEvent,
    body: String,
}

/// Information about a GitHub pull request.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
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

/// Information about a commit in a pull request.
#[derive(Debug, Clone, serde::Serialize)]
pub struct CommitInfo {
    pub sha: String,
    pub message: String,
    pub author: String,
    pub date: String,
    pub commit_url: String,
}

/// Raw GitHub API response for a commit in a pull request.
#[derive(Debug, Deserialize)]
struct GhCommit {
    sha: String,
    commit: GhCommitDetail,
    author: Option<GhUser>,
    html_url: String,
}

#[derive(Debug, Deserialize)]
struct GhCommitDetail {
    message: String,
    author: GhCommitAuthor,
}

#[derive(Debug, Deserialize)]
struct GhCommitAuthor {
    name: String,
    date: String,
}

impl From<GhCommit> for CommitInfo {
    fn from(c: GhCommit) -> Self {
        let author = c.author.map(|u| u.login).unwrap_or(c.commit.author.name);
        Self {
            sha: c.sha,
            message: c.commit.message,
            author,
            date: c.commit.author.date,
            commit_url: c.html_url,
        }
    }
}

/// Maximum number of pages to fetch to prevent infinite loops.
const MAX_PAGES: u32 = 10;

/// Maximum number of pages when fetching PR files (300 files / 100 per page).
const MAX_FILE_PAGES: u32 = 3;

/// Parse the `Link` header to check if a `rel="next"` link exists.
fn has_next_page(link_header: &str) -> bool {
    link_header
        .split(',')
        .any(|part| part.contains("rel=\"next\""))
}

impl GitHubClient {
    /// 新しい `GitHubClient` を作成する。
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::new(),
        }
    }
}

impl Default for GitHubClient {
    fn default() -> Self {
        Self::new()
    }
}

/// Fetch pull requests from a GitHub repository.
///
/// Calls `GET /repos/{owner}/{repo}/pulls` with `state=all` to include open, closed,
/// and merged PRs. Automatically paginates through all pages (up to `MAX_PAGES`).
/// The token should be a GitHub personal access token or similar.
pub async fn list_pull_requests(owner: &str, repo: &str, token: &str) -> Result<Vec<PrInfo>> {
    let client = GitHubClient::new();
    client.list_pull_requests(owner, repo, token).await
}

impl GitHubClient {
    pub async fn list_pull_requests(
        &self,
        owner: &str,
        repo: &str,
        token: &str,
    ) -> Result<Vec<PrInfo>> {
        let mut all_prs = Vec::new();

        for page in 1..=MAX_PAGES {
            let url = format!(
                "https://api.github.com/repos/{owner}/{repo}/pulls?state=all&per_page=100&page={page}"
            );

            let response = self
                .http
                .get(&url)
                .header("Accept", "application/vnd.github+json")
                .header("Authorization", format!("Bearer {token}"))
                .header("User-Agent", "reown")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .send()
                .await
                .with_context(|| {
                    format!("Failed to fetch PRs from {owner}/{repo} (page {page})")
                })?;

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
}

/// Fetch the list of commits for a pull request from GitHub API.
///
/// Calls `GET /repos/{owner}/{repo}/pulls/{pr_number}/commits` and converts
/// the response into `Vec<CommitInfo>`. Paginates up to `MAX_PAGES` pages.
pub async fn list_pr_commits(
    owner: &str,
    repo: &str,
    pr_number: u64,
    token: &str,
) -> Result<Vec<CommitInfo>> {
    let client = GitHubClient::new();
    client.list_pr_commits(owner, repo, pr_number, token).await
}

impl GitHubClient {
    pub async fn list_pr_commits(
        &self,
        owner: &str,
        repo: &str,
        pr_number: u64,
        token: &str,
    ) -> Result<Vec<CommitInfo>> {
        let mut all_commits = Vec::new();

        for page in 1..=MAX_PAGES {
            let url = format!(
                "https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/commits?per_page=100&page={page}"
            );

            let response = self
                .http
                .get(&url)
                .header("Accept", "application/vnd.github+json")
                .header("Authorization", format!("Bearer {token}"))
                .header("User-Agent", "reown")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .send()
                .await
                .with_context(|| {
                    format!(
                        "Failed to fetch PR #{pr_number} commits from {owner}/{repo} (page {page})"
                    )
                })?;

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

            let commits: Vec<GhCommit> = response
                .json()
                .await
                .context("Failed to parse GitHub PR commits response")?;

            let is_empty = commits.is_empty();
            all_commits.extend(commits.into_iter().map(CommitInfo::from));

            if is_empty || !has_next {
                break;
            }
        }

        Ok(all_commits)
    }
}

/// Raw GitHub API response for a single file in a pull request.
#[derive(Debug, Deserialize)]
struct GhPullRequestFile {
    filename: String,
    status: String,
    #[serde(default)]
    previous_filename: Option<String>,
    #[serde(default)]
    patch: Option<String>,
}

/// Parse a unified diff patch string into `DiffChunk`s.
fn parse_patch(patch: &str) -> Vec<DiffChunk> {
    let mut chunks = Vec::new();
    let mut current_chunk: Option<DiffChunk> = None;

    for line in patch.lines() {
        if line.starts_with("@@") {
            if let Some(chunk) = current_chunk.take() {
                chunks.push(chunk);
            }
            current_chunk = Some(DiffChunk {
                header: line.to_string(),
                lines: Vec::new(),
            });

            // Parse hunk header to get starting line numbers
            // Format: @@ -old_start,old_count +new_start,new_count @@
            continue;
        }

        if let Some(chunk) = current_chunk.as_mut() {
            let (origin, content) = if let Some(rest) = line.strip_prefix('+') {
                (LineOrigin::Addition, rest)
            } else if let Some(rest) = line.strip_prefix('-') {
                (LineOrigin::Deletion, rest)
            } else if let Some(rest) = line.strip_prefix(' ') {
                (LineOrigin::Context, rest)
            } else {
                // Lines without a prefix (e.g. "\ No newline at end of file")
                (LineOrigin::Context, line)
            };

            chunk.lines.push(DiffLineInfo {
                origin,
                old_lineno: None,
                new_lineno: None,
                content: format!("{content}\n"),
            });
        }
    }

    if let Some(chunk) = current_chunk {
        chunks.push(chunk);
    }

    // Assign line numbers based on hunk headers
    for chunk in &mut chunks {
        let (mut old_line, mut new_line) = parse_hunk_header(&chunk.header);
        for line in &mut chunk.lines {
            match line.origin {
                LineOrigin::Addition => {
                    line.new_lineno = Some(new_line);
                    new_line += 1;
                }
                LineOrigin::Deletion => {
                    line.old_lineno = Some(old_line);
                    old_line += 1;
                }
                LineOrigin::Context | LineOrigin::Other(_) => {
                    line.old_lineno = Some(old_line);
                    line.new_lineno = Some(new_line);
                    old_line += 1;
                    new_line += 1;
                }
            }
        }
    }

    chunks
}

/// Parse a hunk header like `@@ -1,3 +1,4 @@` to extract (old_start, new_start).
fn parse_hunk_header(header: &str) -> (u32, u32) {
    // Strip @@ prefix/suffix and split
    let trimmed = header
        .trim_start_matches('@')
        .trim()
        .split("@@")
        .next()
        .unwrap_or("");
    let mut old_start = 1u32;
    let mut new_start = 1u32;

    for part in trimmed.split_whitespace() {
        if let Some(rest) = part.strip_prefix('-') {
            if let Some(start) = rest.split(',').next() {
                old_start = start.parse().unwrap_or(1);
            }
        } else if let Some(rest) = part.strip_prefix('+') {
            if let Some(start) = rest.split(',').next() {
                new_start = start.parse().unwrap_or(1);
            }
        }
    }

    (old_start, new_start)
}

impl GhPullRequestFile {
    fn into_file_diff(self) -> FileDiff {
        let status = match self.status.as_str() {
            "added" => FileStatus::Added,
            "removed" => FileStatus::Deleted,
            "modified" | "changed" => FileStatus::Modified,
            "renamed" => FileStatus::Renamed,
            _ => FileStatus::Other,
        };

        let chunks = self.patch.as_deref().map(parse_patch).unwrap_or_default();

        let old_path = match &status {
            FileStatus::Added => None,
            FileStatus::Renamed => self.previous_filename.clone(),
            _ => Some(self.filename.clone()),
        };

        let new_path = match &status {
            FileStatus::Deleted => None,
            _ => Some(self.filename),
        };

        FileDiff {
            old_path,
            new_path,
            status,
            chunks,
        }
    }
}

/// Fetch the list of changed files for a pull request from GitHub API.
///
/// Calls `GET /repos/{owner}/{repo}/pulls/{pr_number}/files` and converts
/// the response into `Vec<FileDiff>`. Paginates up to 300 files (3 pages).
pub async fn get_pull_request_files(
    owner: &str,
    repo: &str,
    pr_number: u64,
    token: &str,
) -> Result<Vec<FileDiff>> {
    let client = GitHubClient::new();
    client
        .get_pull_request_files(owner, repo, pr_number, token)
        .await
}

impl GitHubClient {
    pub async fn get_pull_request_files(
        &self,
        owner: &str,
        repo: &str,
        pr_number: u64,
        token: &str,
    ) -> Result<Vec<FileDiff>> {
        let mut all_files = Vec::new();

        for page in 1..=MAX_FILE_PAGES {
            let url = format!(
                "https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files?per_page=100&page={page}"
            );

            let response = self
                .http
                .get(&url)
                .header("Accept", "application/vnd.github+json")
                .header("Authorization", format!("Bearer {token}"))
                .header("User-Agent", "reown")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .send()
                .await
                .with_context(|| {
                    format!(
                        "Failed to fetch PR #{pr_number} files from {owner}/{repo} (page {page})"
                    )
                })?;

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

            let files: Vec<GhPullRequestFile> = response
                .json()
                .await
                .context("Failed to parse GitHub PR files response")?;

            let is_empty = files.is_empty();
            all_files.extend(files.into_iter().map(GhPullRequestFile::into_file_diff));

            if is_empty || !has_next {
                break;
            }
        }

        Ok(all_files)
    }
}

/// Submit a review on a pull request.
///
/// Calls `POST /repos/{owner}/{repo}/pulls/{pr_number}/reviews` with
/// the specified event (APPROVE or REQUEST_CHANGES) and body text.
pub async fn submit_review(
    owner: &str,
    repo: &str,
    pr_number: u64,
    event: ReviewEvent,
    body: &str,
    token: &str,
) -> Result<()> {
    let client = GitHubClient::new();
    client
        .submit_review(owner, repo, pr_number, event, body, token)
        .await
}

impl GitHubClient {
    pub async fn submit_review(
        &self,
        owner: &str,
        repo: &str,
        pr_number: u64,
        event: ReviewEvent,
        body: &str,
        token: &str,
    ) -> Result<()> {
        let url = format!("https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews");

        let request_body = SubmitReviewRequest {
            event,
            body: body.to_string(),
        };

        let response = self
            .http
            .post(&url)
            .header("Accept", "application/vnd.github+json")
            .header("Authorization", format!("Bearer {token}"))
            .header("User-Agent", "reown")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .json(&request_body)
            .send()
            .await
            .with_context(|| {
                format!("Failed to submit review for PR #{pr_number} in {owner}/{repo}")
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("GitHub API returned {status}: {body}");
        }

        Ok(())
    }
}

/// Add labels to a pull request (via the Issues API).
///
/// Calls `POST /repos/{owner}/{repo}/issues/{issue_number}/labels` with
/// the specified label names. Creates the labels if they don't exist.
pub async fn add_labels(
    owner: &str,
    repo: &str,
    issue_number: u64,
    labels: &[String],
    token: &str,
) -> Result<()> {
    let client = GitHubClient::new();
    client
        .add_labels(owner, repo, issue_number, labels, token)
        .await
}

/// Internal implementation of add_labels that accepts a base URL for testability.
async fn add_labels_with_base_url(
    base_url: &str,
    owner: &str,
    repo: &str,
    issue_number: u64,
    labels: &[String],
    token: &str,
) -> Result<()> {
    let client = GitHubClient::new();
    client
        .add_labels_with_base_url(base_url, owner, repo, issue_number, labels, token)
        .await
}

impl GitHubClient {
    pub async fn add_labels(
        &self,
        owner: &str,
        repo: &str,
        issue_number: u64,
        labels: &[String],
        token: &str,
    ) -> Result<()> {
        self.add_labels_with_base_url(
            "https://api.github.com",
            owner,
            repo,
            issue_number,
            labels,
            token,
        )
        .await
    }

    async fn add_labels_with_base_url(
        &self,
        base_url: &str,
        owner: &str,
        repo: &str,
        issue_number: u64,
        labels: &[String],
        token: &str,
    ) -> Result<()> {
        let url = format!("{base_url}/repos/{owner}/{repo}/issues/{issue_number}/labels");

        let body = serde_json::json!({ "labels": labels });

        let response = self
            .http
            .post(&url)
            .header("Accept", "application/vnd.github+json")
            .header("Authorization", format!("Bearer {token}"))
            .header("User-Agent", "reown")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .json(&body)
            .send()
            .await
            .with_context(|| {
                format!("Failed to add labels to issue/PR #{issue_number} in {owner}/{repo}")
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("GitHub API returned {status}: {body}");
        }

        Ok(())
    }
}

/// GraphQL response for fetching a PR's node ID.
#[derive(Debug, Deserialize)]
struct GhGraphQlResponse<T> {
    data: Option<T>,
    errors: Option<Vec<GhGraphQlError>>,
}

#[derive(Debug, Deserialize)]
struct GhGraphQlError {
    message: String,
}

#[derive(Debug, Deserialize)]
struct GhPrNodeIdData {
    repository: GhRepositoryNode,
}

#[derive(Debug, Deserialize)]
struct GhRepositoryNode {
    #[serde(rename = "pullRequest")]
    pull_request: GhPrNode,
}

#[derive(Debug, Deserialize)]
struct GhPrNode {
    id: String,
}

#[derive(Debug, Deserialize)]
struct GhEnableAutoMergeData {
    #[serde(rename = "enablePullRequestAutoMerge")]
    enable_pull_request_auto_merge: Option<GhAutoMergePayload>,
}

#[derive(Debug, Deserialize)]
struct GhAutoMergePayload {
    #[serde(rename = "pullRequest")]
    pull_request: Option<GhAutoMergePrInfo>,
}

#[derive(Debug, Deserialize)]
struct GhAutoMergePrInfo {
    #[serde(rename = "autoMergeRequest")]
    auto_merge_request: Option<GhAutoMergeRequest>,
}

#[derive(Debug, Deserialize)]
struct GhAutoMergeRequest {
    #[serde(rename = "enabledAt")]
    enabled_at: Option<String>,
}

/// Build the GraphQL request body for fetching a PR's node ID.
fn build_pr_node_id_query(owner: &str, repo: &str, pr_number: u64) -> serde_json::Value {
    serde_json::json!({
        "query": format!(
            r#"query {{ repository(owner: "{owner}", name: "{repo}") {{ pullRequest(number: {pr_number}) {{ id }} }} }}"#
        )
    })
}

/// Build the GraphQL request body for the enablePullRequestAutoMerge mutation.
fn build_enable_auto_merge_mutation(
    pull_request_id: &str,
    merge_method: &MergeMethod,
) -> serde_json::Value {
    let method = match merge_method {
        MergeMethod::Merge => "MERGE",
        MergeMethod::Squash => "SQUASH",
        MergeMethod::Rebase => "REBASE",
    };
    serde_json::json!({
        "query": format!(
            r#"mutation {{ enablePullRequestAutoMerge(input: {{ pullRequestId: "{pull_request_id}", mergeMethod: {method} }}) {{ pullRequest {{ autoMergeRequest {{ enabledAt }} }} }} }}"#
        )
    })
}

const GITHUB_GRAPHQL_URL: &str = "https://api.github.com/graphql";

/// Enable auto-merge for a pull request.
///
/// Uses GitHub's GraphQL API to:
/// 1. Fetch the PR's node ID
/// 2. Call the `enablePullRequestAutoMerge` mutation with the specified merge method
pub async fn enable_auto_merge(
    token: &str,
    owner: &str,
    repo: &str,
    pr_number: u64,
    merge_method: MergeMethod,
) -> Result<()> {
    let client = GitHubClient::new();
    client
        .enable_auto_merge(token, owner, repo, pr_number, merge_method)
        .await
}

impl GitHubClient {
    pub async fn enable_auto_merge(
        &self,
        token: &str,
        owner: &str,
        repo: &str,
        pr_number: u64,
        merge_method: MergeMethod,
    ) -> Result<()> {
        // Step 1: Fetch the PR's node ID
        let node_id_body = build_pr_node_id_query(owner, repo, pr_number);

        let response = self
            .http
            .post(GITHUB_GRAPHQL_URL)
            .header("Authorization", format!("Bearer {token}"))
            .header("User-Agent", "reown")
            .json(&node_id_body)
            .send()
            .await
            .with_context(|| {
                format!("Failed to fetch node ID for PR #{pr_number} in {owner}/{repo}")
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("GitHub GraphQL API returned {status}: {body}");
        }

        let node_id_response: GhGraphQlResponse<GhPrNodeIdData> = response
            .json()
            .await
            .context("Failed to parse GraphQL response for PR node ID")?;

        if let Some(errors) = node_id_response.errors {
            let messages: Vec<String> = errors.into_iter().map(|e| e.message).collect();
            anyhow::bail!("GraphQL errors: {}", messages.join(", "));
        }

        let pull_request_id = node_id_response
            .data
            .map(|d| d.repository.pull_request.id)
            .ok_or_else(|| anyhow::anyhow!("No data in GraphQL response for PR #{pr_number}"))?;

        // Step 2: Call enablePullRequestAutoMerge mutation
        let mutation_body = build_enable_auto_merge_mutation(&pull_request_id, &merge_method);

        let response = self
            .http
            .post(GITHUB_GRAPHQL_URL)
            .header("Authorization", format!("Bearer {token}"))
            .header("User-Agent", "reown")
            .json(&mutation_body)
            .send()
            .await
            .with_context(|| {
                format!("Failed to enable auto-merge for PR #{pr_number} in {owner}/{repo}")
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("GitHub GraphQL API returned {status}: {body}");
        }

        let mutation_response: GhGraphQlResponse<GhEnableAutoMergeData> = response
            .json()
            .await
            .context("Failed to parse GraphQL response for enablePullRequestAutoMerge")?;

        if let Some(errors) = mutation_response.errors {
            let messages: Vec<String> = errors.into_iter().map(|e| e.message).collect();
            anyhow::bail!("GraphQL errors: {}", messages.join(", "));
        }

        Ok(())
    }
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

    /// Test parsing a unified diff patch into DiffChunks.
    #[test]
    fn test_parse_patch_basic() {
        let patch = "@@ -1,3 +1,4 @@\n context line\n-removed line\n+added line\n+new line";
        let chunks = parse_patch(patch);

        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].header, "@@ -1,3 +1,4 @@");
        assert_eq!(chunks[0].lines.len(), 4);

        assert_eq!(chunks[0].lines[0].origin, LineOrigin::Context);
        assert_eq!(chunks[0].lines[0].old_lineno, Some(1));
        assert_eq!(chunks[0].lines[0].new_lineno, Some(1));

        assert_eq!(chunks[0].lines[1].origin, LineOrigin::Deletion);
        assert_eq!(chunks[0].lines[1].old_lineno, Some(2));
        assert!(chunks[0].lines[1].new_lineno.is_none());

        assert_eq!(chunks[0].lines[2].origin, LineOrigin::Addition);
        assert!(chunks[0].lines[2].old_lineno.is_none());
        assert_eq!(chunks[0].lines[2].new_lineno, Some(2));

        assert_eq!(chunks[0].lines[3].origin, LineOrigin::Addition);
        assert!(chunks[0].lines[3].old_lineno.is_none());
        assert_eq!(chunks[0].lines[3].new_lineno, Some(3));
    }

    /// Test parsing a patch with multiple hunks.
    #[test]
    fn test_parse_patch_multiple_hunks() {
        let patch = "@@ -1,2 +1,2 @@\n-old\n+new\n@@ -10,2 +10,3 @@\n context\n+added\n context";
        let chunks = parse_patch(patch);

        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].lines.len(), 2);
        assert_eq!(chunks[1].lines.len(), 3);
        assert_eq!(chunks[1].header, "@@ -10,2 +10,3 @@");

        // Second hunk starts at line 10
        assert_eq!(chunks[1].lines[0].old_lineno, Some(10));
        assert_eq!(chunks[1].lines[0].new_lineno, Some(10));
    }

    /// Test parsing an empty patch.
    #[test]
    fn test_parse_patch_empty() {
        let chunks = parse_patch("");
        assert!(chunks.is_empty());
    }

    /// Test hunk header parsing.
    #[test]
    fn test_parse_hunk_header() {
        assert_eq!(parse_hunk_header("@@ -1,3 +1,4 @@"), (1, 1));
        assert_eq!(parse_hunk_header("@@ -10,5 +20,8 @@"), (10, 20));
        assert_eq!(parse_hunk_header("@@ -1 +1 @@"), (1, 1));
        assert_eq!(
            parse_hunk_header("@@ -100,3 +200,5 @@ fn main()"),
            (100, 200)
        );
    }

    /// Test GitHub PR file response deserialization.
    #[test]
    fn test_parse_pr_files_response() {
        let json = r#"[
            {
                "filename": "src/main.rs",
                "status": "modified",
                "patch": "@@ -1,3 +1,4 @@\n fn main() {\n+    println!(\"hello\");\n }"
            },
            {
                "filename": "src/new.rs",
                "status": "added",
                "patch": "@@ -0,0 +1,2 @@\n+line1\n+line2"
            }
        ]"#;

        let files: Vec<GhPullRequestFile> = serde_json::from_str(json).unwrap();
        let diffs: Vec<FileDiff> = files
            .into_iter()
            .map(GhPullRequestFile::into_file_diff)
            .collect();

        assert_eq!(diffs.len(), 2);

        assert_eq!(diffs[0].new_path.as_deref(), Some("src/main.rs"));
        assert_eq!(diffs[0].old_path.as_deref(), Some("src/main.rs"));
        assert_eq!(diffs[0].status, FileStatus::Modified);
        assert!(!diffs[0].chunks.is_empty());

        assert_eq!(diffs[1].new_path.as_deref(), Some("src/new.rs"));
        assert!(diffs[1].old_path.is_none());
        assert_eq!(diffs[1].status, FileStatus::Added);
    }

    /// Test file status mapping from GitHub API statuses.
    #[test]
    fn test_file_status_mapping() {
        let make_file = |status: &str| GhPullRequestFile {
            filename: "test.rs".to_string(),
            status: status.to_string(),
            previous_filename: None,
            patch: None,
        };

        assert_eq!(
            make_file("added").into_file_diff().status,
            FileStatus::Added
        );
        assert_eq!(
            make_file("removed").into_file_diff().status,
            FileStatus::Deleted
        );
        assert_eq!(
            make_file("modified").into_file_diff().status,
            FileStatus::Modified
        );
        assert_eq!(
            make_file("changed").into_file_diff().status,
            FileStatus::Modified
        );
        assert_eq!(
            make_file("renamed").into_file_diff().status,
            FileStatus::Renamed
        );
        assert_eq!(
            make_file("copied").into_file_diff().status,
            FileStatus::Other
        );
    }

    /// Test renamed file uses previous_filename for old_path.
    #[test]
    fn test_renamed_file_paths() {
        let file = GhPullRequestFile {
            filename: "new_name.rs".to_string(),
            status: "renamed".to_string(),
            previous_filename: Some("old_name.rs".to_string()),
            patch: None,
        };

        let diff = file.into_file_diff();
        assert_eq!(diff.old_path.as_deref(), Some("old_name.rs"));
        assert_eq!(diff.new_path.as_deref(), Some("new_name.rs"));
        assert_eq!(diff.status, FileStatus::Renamed);
    }

    /// Test deleted file has no new_path.
    #[test]
    fn test_deleted_file_paths() {
        let file = GhPullRequestFile {
            filename: "removed.rs".to_string(),
            status: "removed".to_string(),
            previous_filename: None,
            patch: None,
        };

        let diff = file.into_file_diff();
        assert_eq!(diff.old_path.as_deref(), Some("removed.rs"));
        assert!(diff.new_path.is_none());
        assert_eq!(diff.status, FileStatus::Deleted);
    }

    /// Test file without patch (e.g. binary file) has empty chunks.
    #[test]
    fn test_file_without_patch() {
        let file = GhPullRequestFile {
            filename: "image.png".to_string(),
            status: "added".to_string(),
            previous_filename: None,
            patch: None,
        };

        let diff = file.into_file_diff();
        assert!(diff.chunks.is_empty());
    }

    /// Test ReviewEvent serializes to SCREAMING_SNAKE_CASE.
    #[test]
    fn test_review_event_serialize() {
        let approve = serde_json::to_value(&ReviewEvent::Approve).unwrap();
        assert_eq!(approve, "APPROVE");

        let request_changes = serde_json::to_value(&ReviewEvent::RequestChanges).unwrap();
        assert_eq!(request_changes, "REQUEST_CHANGES");
    }

    /// Test ReviewEvent deserializes from SCREAMING_SNAKE_CASE.
    #[test]
    fn test_review_event_deserialize() {
        let approve: ReviewEvent = serde_json::from_str("\"APPROVE\"").unwrap();
        assert_eq!(approve, ReviewEvent::Approve);

        let request_changes: ReviewEvent = serde_json::from_str("\"REQUEST_CHANGES\"").unwrap();
        assert_eq!(request_changes, ReviewEvent::RequestChanges);
    }

    /// Test SubmitReviewRequest serializes correctly.
    #[test]
    fn test_submit_review_request_serialize() {
        let request = SubmitReviewRequest {
            event: ReviewEvent::Approve,
            body: "LGTM!".to_string(),
        };
        let json = serde_json::to_value(&request).unwrap();
        assert_eq!(json["event"], "APPROVE");
        assert_eq!(json["body"], "LGTM!");

        let request = SubmitReviewRequest {
            event: ReviewEvent::RequestChanges,
            body: "Please fix the error handling.".to_string(),
        };
        let json = serde_json::to_value(&request).unwrap();
        assert_eq!(json["event"], "REQUEST_CHANGES");
        assert_eq!(json["body"], "Please fix the error handling.");
    }

    /// Test SubmitReviewRequest with empty body.
    #[test]
    fn test_submit_review_request_empty_body() {
        let request = SubmitReviewRequest {
            event: ReviewEvent::Approve,
            body: String::new(),
        };
        let json = serde_json::to_value(&request).unwrap();
        assert_eq!(json["event"], "APPROVE");
        assert_eq!(json["body"], "");
    }

    /// Test that a valid GitHub commits API response deserializes correctly into CommitInfo.
    #[test]
    fn test_parse_commit_response() {
        let json = r#"[
            {
                "sha": "abc123def456",
                "commit": {
                    "message": "feat: add new feature",
                    "author": {
                        "name": "Alice",
                        "date": "2025-01-15T10:30:00Z"
                    }
                },
                "author": { "login": "alice" },
                "html_url": "https://github.com/owner/repo/commit/abc123def456"
            },
            {
                "sha": "789ghi012jkl",
                "commit": {
                    "message": "fix: resolve bug\n\nDetailed description of the fix.",
                    "author": {
                        "name": "Bob Smith",
                        "date": "2025-01-16T08:00:00Z"
                    }
                },
                "author": { "login": "bob" },
                "html_url": "https://github.com/owner/repo/commit/789ghi012jkl"
            }
        ]"#;

        let gh_commits: Vec<GhCommit> = serde_json::from_str(json).unwrap();
        let commits: Vec<CommitInfo> = gh_commits.into_iter().map(CommitInfo::from).collect();

        assert_eq!(commits.len(), 2);

        assert_eq!(commits[0].sha, "abc123def456");
        assert_eq!(commits[0].message, "feat: add new feature");
        assert_eq!(commits[0].author, "alice");
        assert_eq!(commits[0].date, "2025-01-15T10:30:00Z");
        assert_eq!(
            commits[0].commit_url,
            "https://github.com/owner/repo/commit/abc123def456"
        );

        assert_eq!(commits[1].sha, "789ghi012jkl");
        assert_eq!(
            commits[1].message,
            "fix: resolve bug\n\nDetailed description of the fix."
        );
        assert_eq!(commits[1].author, "bob");
        assert_eq!(commits[1].date, "2025-01-16T08:00:00Z");
    }

    /// Test that when GitHub author is null, the commit author name is used as fallback.
    #[test]
    fn test_parse_commit_without_github_author() {
        let json = r#"[
            {
                "sha": "deadbeef",
                "commit": {
                    "message": "chore: update deps",
                    "author": {
                        "name": "CI Bot",
                        "date": "2025-02-01T00:00:00Z"
                    }
                },
                "author": null,
                "html_url": "https://github.com/owner/repo/commit/deadbeef"
            }
        ]"#;

        let gh_commits: Vec<GhCommit> = serde_json::from_str(json).unwrap();
        let commits: Vec<CommitInfo> = gh_commits.into_iter().map(CommitInfo::from).collect();

        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].sha, "deadbeef");
        assert_eq!(commits[0].author, "CI Bot");
    }

    /// Test parsing an empty commits response.
    #[test]
    fn test_parse_empty_commits_list() {
        let json = "[]";
        let gh_commits: Vec<GhCommit> = serde_json::from_str(json).unwrap();
        let commits: Vec<CommitInfo> = gh_commits.into_iter().map(CommitInfo::from).collect();
        assert!(commits.is_empty());
    }

    /// Test MergeMethod serializes to SCREAMING_SNAKE_CASE.
    #[test]
    fn test_merge_method_serialize() {
        assert_eq!(serde_json::to_value(&MergeMethod::Merge).unwrap(), "MERGE");
        assert_eq!(
            serde_json::to_value(&MergeMethod::Squash).unwrap(),
            "SQUASH"
        );
        assert_eq!(
            serde_json::to_value(&MergeMethod::Rebase).unwrap(),
            "REBASE"
        );
    }

    /// Test MergeMethod deserializes from SCREAMING_SNAKE_CASE.
    #[test]
    fn test_merge_method_deserialize() {
        let merge: MergeMethod = serde_json::from_str("\"MERGE\"").unwrap();
        assert_eq!(merge, MergeMethod::Merge);

        let squash: MergeMethod = serde_json::from_str("\"SQUASH\"").unwrap();
        assert_eq!(squash, MergeMethod::Squash);

        let rebase: MergeMethod = serde_json::from_str("\"REBASE\"").unwrap();
        assert_eq!(rebase, MergeMethod::Rebase);
    }

    /// Test that the GraphQL query for fetching PR node ID is constructed correctly.
    #[test]
    fn test_build_pr_node_id_query() {
        let query = build_pr_node_id_query("owner", "repo", 42);
        let query_str = query["query"].as_str().unwrap();

        assert!(query_str.contains("repository(owner: \"owner\", name: \"repo\")"));
        assert!(query_str.contains("pullRequest(number: 42)"));
        assert!(query_str.contains("id"));
    }

    /// Test that the GraphQL mutation for enabling auto-merge is constructed correctly.
    #[test]
    fn test_build_enable_auto_merge_mutation_merge() {
        let mutation = build_enable_auto_merge_mutation("PR_node_id_123", &MergeMethod::Merge);
        let query_str = mutation["query"].as_str().unwrap();

        assert!(query_str.contains("enablePullRequestAutoMerge"));
        assert!(query_str.contains("pullRequestId: \"PR_node_id_123\""));
        assert!(query_str.contains("mergeMethod: MERGE"));
        assert!(query_str.contains("autoMergeRequest"));
        assert!(query_str.contains("enabledAt"));
    }

    /// Test that the mutation uses SQUASH merge method.
    #[test]
    fn test_build_enable_auto_merge_mutation_squash() {
        let mutation = build_enable_auto_merge_mutation("PR_node_id_456", &MergeMethod::Squash);
        let query_str = mutation["query"].as_str().unwrap();

        assert!(query_str.contains("mergeMethod: SQUASH"));
        assert!(query_str.contains("pullRequestId: \"PR_node_id_456\""));
    }

    /// Test that the mutation uses REBASE merge method.
    #[test]
    fn test_build_enable_auto_merge_mutation_rebase() {
        let mutation = build_enable_auto_merge_mutation("PR_node_id_789", &MergeMethod::Rebase);
        let query_str = mutation["query"].as_str().unwrap();

        assert!(query_str.contains("mergeMethod: REBASE"));
    }

    /// Test GraphQL response deserialization for PR node ID.
    #[test]
    fn test_parse_graphql_pr_node_id_response() {
        let json = r#"{
            "data": {
                "repository": {
                    "pullRequest": {
                        "id": "PR_kwDOTest123"
                    }
                }
            }
        }"#;

        let response: GhGraphQlResponse<GhPrNodeIdData> = serde_json::from_str(json).unwrap();
        assert!(response.errors.is_none());
        let data = response.data.unwrap();
        assert_eq!(data.repository.pull_request.id, "PR_kwDOTest123");
    }

    /// Test GraphQL error response deserialization.
    #[test]
    fn test_parse_graphql_error_response() {
        let json = r#"{
            "data": null,
            "errors": [
                { "message": "Could not resolve to a Repository" }
            ]
        }"#;

        let response: GhGraphQlResponse<GhPrNodeIdData> = serde_json::from_str(json).unwrap();
        assert!(response.data.is_none());
        let errors = response.errors.unwrap();
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].message, "Could not resolve to a Repository");
    }

    /// Test GraphQL enable auto-merge response deserialization.
    #[test]
    fn test_parse_enable_auto_merge_response() {
        let json = r#"{
            "data": {
                "enablePullRequestAutoMerge": {
                    "pullRequest": {
                        "autoMergeRequest": {
                            "enabledAt": "2025-01-15T10:30:00Z"
                        }
                    }
                }
            }
        }"#;

        let response: GhGraphQlResponse<GhEnableAutoMergeData> =
            serde_json::from_str(json).unwrap();
        assert!(response.errors.is_none());
        let data = response.data.unwrap();
        let payload = data.enable_pull_request_auto_merge.unwrap();
        let pr = payload.pull_request.unwrap();
        let auto_merge = pr.auto_merge_request.unwrap();
        assert_eq!(auto_merge.enabled_at.unwrap(), "2025-01-15T10:30:00Z");
    }

    /// Test CommitInfo serializes correctly for Tauri IPC.
    #[test]
    fn test_commit_info_serializes() {
        let commit = CommitInfo {
            sha: "abc123".to_string(),
            message: "test commit".to_string(),
            author: "alice".to_string(),
            date: "2025-01-15T10:30:00Z".to_string(),
            commit_url: "https://github.com/owner/repo/commit/abc123".to_string(),
        };
        let json = serde_json::to_value(&commit).unwrap();
        assert_eq!(json["sha"], "abc123");
        assert_eq!(json["message"], "test commit");
        assert_eq!(json["author"], "alice");
        assert_eq!(json["date"], "2025-01-15T10:30:00Z");
        assert_eq!(
            json["commit_url"],
            "https://github.com/owner/repo/commit/abc123"
        );
    }

    /// Test add_labels succeeds with a 200 response.
    #[tokio::test]
    async fn test_add_labels_success() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/repos/owner/repo/issues/42/labels")
            .match_header("Accept", "application/vnd.github+json")
            .match_header("Authorization", "Bearer test-token")
            .match_header("User-Agent", "reown")
            .match_header("X-GitHub-Api-Version", "2022-11-28")
            .match_body(mockito::Matcher::Json(
                serde_json::json!({"labels": ["bug", "urgent"]}),
            ))
            .with_status(200)
            .with_body(r#"[{"id":1,"name":"bug"},{"id":2,"name":"urgent"}]"#)
            .create_async()
            .await;

        let labels = vec!["bug".to_string(), "urgent".to_string()];
        let result =
            add_labels_with_base_url(&server.url(), "owner", "repo", 42, &labels, "test-token")
                .await;

        assert!(result.is_ok());
        mock.assert_async().await;
    }

    /// Test add_labels with a single label.
    #[tokio::test]
    async fn test_add_labels_single_label() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/repos/owner/repo/issues/1/labels")
            .match_body(mockito::Matcher::Json(
                serde_json::json!({"labels": ["enhancement"]}),
            ))
            .with_status(200)
            .with_body(r#"[{"id":1,"name":"enhancement"}]"#)
            .create_async()
            .await;

        let labels = vec!["enhancement".to_string()];
        let result =
            add_labels_with_base_url(&server.url(), "owner", "repo", 1, &labels, "token").await;

        assert!(result.is_ok());
        mock.assert_async().await;
    }

    /// Test add_labels with empty labels list.
    #[tokio::test]
    async fn test_add_labels_empty_labels() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/repos/owner/repo/issues/10/labels")
            .match_body(mockito::Matcher::Json(serde_json::json!({"labels": []})))
            .with_status(200)
            .with_body("[]")
            .create_async()
            .await;

        let labels: Vec<String> = vec![];
        let result =
            add_labels_with_base_url(&server.url(), "owner", "repo", 10, &labels, "token").await;

        assert!(result.is_ok());
        mock.assert_async().await;
    }

    /// Test add_labels returns error on 404 (e.g., repo not found).
    #[tokio::test]
    async fn test_add_labels_not_found() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/repos/owner/nonexistent/issues/1/labels")
            .with_status(404)
            .with_body(r#"{"message":"Not Found"}"#)
            .create_async()
            .await;

        let labels = vec!["bug".to_string()];
        let result =
            add_labels_with_base_url(&server.url(), "owner", "nonexistent", 1, &labels, "token")
                .await;

        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("404"));
        mock.assert_async().await;
    }

    /// Test add_labels returns error on 401 (unauthorized).
    #[tokio::test]
    async fn test_add_labels_unauthorized() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/repos/owner/repo/issues/5/labels")
            .with_status(401)
            .with_body(r#"{"message":"Bad credentials"}"#)
            .create_async()
            .await;

        let labels = vec!["bug".to_string()];
        let result =
            add_labels_with_base_url(&server.url(), "owner", "repo", 5, &labels, "bad-token").await;

        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("401"));
        mock.assert_async().await;
    }

    /// Test add_labels returns error on 422 (validation failed).
    #[tokio::test]
    async fn test_add_labels_validation_error() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/repos/owner/repo/issues/3/labels")
            .with_status(422)
            .with_body(r#"{"message":"Validation Failed"}"#)
            .create_async()
            .await;

        let labels = vec!["invalid\0label".to_string()];
        let result =
            add_labels_with_base_url(&server.url(), "owner", "repo", 3, &labels, "token").await;

        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("422"));
        mock.assert_async().await;
    }

    /// Test add_labels returns error on 500 (server error).
    #[tokio::test]
    async fn test_add_labels_server_error() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/repos/owner/repo/issues/7/labels")
            .with_status(500)
            .with_body(r#"{"message":"Internal Server Error"}"#)
            .create_async()
            .await;

        let labels = vec!["bug".to_string()];
        let result =
            add_labels_with_base_url(&server.url(), "owner", "repo", 7, &labels, "token").await;

        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("500"));
        mock.assert_async().await;
    }
}
