use serde::Deserialize;

/// A GitHub pull request.
#[derive(Debug, Clone, Deserialize)]
pub struct PullRequest {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub user: User,
    pub html_url: String,
}

/// A GitHub user (nested in PR responses).
#[derive(Debug, Clone, Deserialize)]
pub struct User {
    pub login: String,
}
