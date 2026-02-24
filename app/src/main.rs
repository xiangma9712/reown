// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod error;

use error::AppError;
use tauri::Manager;

// ── Branch commands ─────────────────────────────────────────────────────────

#[tauri::command]
fn list_branches(repo_path: String) -> Result<Vec<reown::git::branch::BranchInfo>, AppError> {
    reown::git::branch::list_branches(&repo_path).map_err(AppError::git)
}

#[tauri::command]
fn create_branch(repo_path: String, name: String) -> Result<(), AppError> {
    reown::git::branch::create_branch(&repo_path, &name).map_err(AppError::git)
}

#[tauri::command]
fn switch_branch(repo_path: String, name: String) -> Result<(), AppError> {
    reown::git::branch::switch_branch(&repo_path, &name).map_err(AppError::git)
}

#[tauri::command]
fn delete_branch(repo_path: String, name: String) -> Result<(), AppError> {
    reown::git::branch::delete_branch(&repo_path, &name).map_err(AppError::git)
}

// ── Worktree commands ───────────────────────────────────────────────────────

#[tauri::command]
fn list_worktrees(repo_path: String) -> Result<Vec<reown::git::worktree::WorktreeInfo>, AppError> {
    reown::git::worktree::list_worktrees(&repo_path).map_err(AppError::git)
}

#[tauri::command]
fn add_worktree(repo_path: String, worktree_path: String, branch: String) -> Result<(), AppError> {
    reown::git::worktree::add_worktree(&repo_path, &worktree_path, &branch)
        .map_err(AppError::git)
}

// ── Diff commands ───────────────────────────────────────────────────────────

#[tauri::command]
fn diff_workdir(repo_path: String) -> Result<Vec<reown::git::diff::FileDiff>, AppError> {
    reown::git::diff::diff_workdir(&repo_path).map_err(AppError::git)
}

#[tauri::command]
fn diff_commit(
    repo_path: String,
    commit_sha: String,
) -> Result<Vec<reown::git::diff::FileDiff>, AppError> {
    reown::git::diff::diff_commit(&repo_path, &commit_sha).map_err(AppError::git)
}

// ── GitHub commands ─────────────────────────────────────────────────────────

#[tauri::command]
async fn list_pull_requests(
    owner: String,
    repo: String,
    token: String,
) -> Result<Vec<reown::github::PrInfo>, AppError> {
    reown::github::pull_request::list_pull_requests(&owner, &repo, &token)
        .await
        .map_err(AppError::github)
}

#[tauri::command]
async fn get_pull_request_files(
    owner: String,
    repo: String,
    pr_number: u64,
    token: String,
) -> Result<Vec<reown::git::diff::FileDiff>, AppError> {
    reown::github::pull_request::get_pull_request_files(&owner, &repo, pr_number, &token)
        .await
        .map_err(AppError::github)
}

// ── Git info commands ──────────────────────────────────────────────────────

#[tauri::command]
fn get_repo_info(repo_path: String) -> Result<reown::git::RepoInfo, AppError> {
    reown::git::get_repo_info(&repo_path).map_err(AppError::git)
}

// ── Repository commands ────────────────────────────────────────────────────

#[tauri::command]
fn add_repository(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<reown::repository::RepositoryEntry, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let storage_path = reown::repository::default_storage_path(&app_data_dir);
    reown::repository::add_repository(&storage_path, &path).map_err(AppError::storage)
}

#[tauri::command]
fn list_repositories(
    app_handle: tauri::AppHandle,
) -> Result<Vec<reown::repository::RepositoryEntry>, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let storage_path = reown::repository::default_storage_path(&app_data_dir);
    reown::repository::load_repositories(&storage_path).map_err(AppError::storage)
}

#[tauri::command]
fn remove_repository(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<(), AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let storage_path = reown::repository::default_storage_path(&app_data_dir);
    reown::repository::remove_repository(&storage_path, &path).map_err(AppError::storage)
}

// ── Analysis commands ───────────────────────────────────────────────────────

#[tauri::command]
async fn analyze_pr_risk(
    owner: String,
    repo: String,
    pr_number: u64,
    token: String,
) -> Result<reown::analysis::AnalysisResult, AppError> {
    let prs = reown::github::pull_request::list_pull_requests(&owner, &repo, &token)
        .await
        .map_err(AppError::github)?;

    let pr = prs
        .into_iter()
        .find(|p| p.number == pr_number)
        .ok_or_else(|| {
            AppError::analysis(anyhow::anyhow!("PR #{pr_number} not found"))
        })?;

    let diffs =
        reown::github::pull_request::get_pull_request_files(&owner, &repo, pr_number, &token)
            .await
            .map_err(AppError::github)?;

    Ok(reown::analysis::analyze_pr_risk(&pr, &diffs))
}

// ── Config commands ─────────────────────────────────────────────────────────

#[tauri::command]
fn save_app_config(
    app_handle: tauri::AppHandle,
    config: reown::config::AppConfig,
) -> Result<(), AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let config_path = reown::config::default_config_path(&app_data_dir);
    reown::config::save_config(&config_path, &config).map_err(AppError::storage)
}

#[tauri::command]
fn load_app_config(
    app_handle: tauri::AppHandle,
) -> Result<reown::config::AppConfig, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let config_path = reown::config::default_config_path(&app_data_dir);
    reown::config::load_config(&config_path).map_err(AppError::storage)
}

// ── Main ────────────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_branches,
            create_branch,
            switch_branch,
            delete_branch,
            list_worktrees,
            add_worktree,
            diff_workdir,
            diff_commit,
            list_pull_requests,
            get_pull_request_files,
            analyze_pr_risk,
            get_repo_info,
            add_repository,
            list_repositories,
            remove_repository,
            save_app_config,
            load_app_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use crate::error::{AppError, ErrorKind};
    use reown::git::branch::BranchInfo;
    use reown::git::diff::{DiffChunk, DiffLineInfo, FileDiff, FileStatus, LineOrigin};
    use reown::git::worktree::WorktreeInfo;
    use reown::github::PrInfo;
    use std::path::PathBuf;

    #[test]
    fn test_branch_info_serializes() {
        let info = BranchInfo {
            name: "main".to_string(),
            is_head: true,
            upstream: Some("origin/main".to_string()),
        };
        let json = serde_json::to_value(&info).unwrap();
        assert_eq!(json["name"], "main");
        assert_eq!(json["is_head"], true);
        assert_eq!(json["upstream"], "origin/main");
    }

    #[test]
    fn test_worktree_info_serializes() {
        let info = WorktreeInfo {
            name: "feature".to_string(),
            path: PathBuf::from("/tmp/wt"),
            branch: Some("feature-branch".to_string()),
            is_main: false,
            is_locked: false,
        };
        let json = serde_json::to_value(&info).unwrap();
        assert_eq!(json["name"], "feature");
        assert_eq!(json["branch"], "feature-branch");
        assert_eq!(json["is_main"], false);
        assert_eq!(json["is_locked"], false);
    }

    #[test]
    fn test_file_diff_serializes() {
        let diff = FileDiff {
            old_path: Some("a.rs".to_string()),
            new_path: Some("a.rs".to_string()),
            status: FileStatus::Modified,
            chunks: vec![DiffChunk {
                header: "@@ -1,3 +1,4 @@".to_string(),
                lines: vec![DiffLineInfo {
                    origin: LineOrigin::Addition,
                    old_lineno: None,
                    new_lineno: Some(4),
                    content: "new line\n".to_string(),
                }],
            }],
        };
        let json = serde_json::to_value(&diff).unwrap();
        assert_eq!(json["old_path"], "a.rs");
        assert_eq!(json["status"], "Modified");
        assert_eq!(json["chunks"][0]["header"], "@@ -1,3 +1,4 @@");
        assert_eq!(json["chunks"][0]["lines"][0]["origin"], "Addition");
        assert_eq!(json["chunks"][0]["lines"][0]["new_lineno"], 4);
        assert!(json["chunks"][0]["lines"][0]["old_lineno"].is_null());
    }

    #[test]
    fn test_pr_info_serializes() {
        let pr = PrInfo {
            number: 42,
            title: "Add feature".to_string(),
            author: "alice".to_string(),
            state: "open".to_string(),
            head_branch: "feature-x".to_string(),
            base_branch: "main".to_string(),
            updated_at: "2025-01-15T10:30:00Z".to_string(),
            additions: 100,
            deletions: 20,
            changed_files: 5,
            body: "PR description".to_string(),
            html_url: "https://github.com/owner/repo/pull/42".to_string(),
        };
        let json = serde_json::to_value(&pr).unwrap();
        assert_eq!(json["number"], 42);
        assert_eq!(json["title"], "Add feature");
        assert_eq!(json["author"], "alice");
        assert_eq!(json["state"], "open");
        assert_eq!(json["head_branch"], "feature-x");
        assert_eq!(json["base_branch"], "main");
        assert_eq!(json["additions"], 100);
        assert_eq!(json["deletions"], 20);
        assert_eq!(json["changed_files"], 5);
        assert_eq!(json["body"], "PR description");
        assert_eq!(json["html_url"], "https://github.com/owner/repo/pull/42");
    }

    #[test]
    fn test_file_status_all_variants_serialize() {
        for (status, expected) in [
            (FileStatus::Added, "Added"),
            (FileStatus::Deleted, "Deleted"),
            (FileStatus::Modified, "Modified"),
            (FileStatus::Renamed, "Renamed"),
            (FileStatus::Other, "Other"),
        ] {
            let json = serde_json::to_value(&status).unwrap();
            assert_eq!(json, expected);
        }
    }

    #[test]
    fn test_line_origin_all_variants_serialize() {
        let json = serde_json::to_value(&LineOrigin::Addition).unwrap();
        assert_eq!(json, "Addition");
        let json = serde_json::to_value(&LineOrigin::Deletion).unwrap();
        assert_eq!(json, "Deletion");
        let json = serde_json::to_value(&LineOrigin::Context).unwrap();
        assert_eq!(json, "Context");
        let json = serde_json::to_value(LineOrigin::Other('=')).unwrap();
        assert_eq!(json["Other"], "=");
    }

    #[test]
    fn test_app_error_git_serializes() {
        let err = AppError::git(anyhow::anyhow!("repo not found"));
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["kind"], "git");
        assert_eq!(json["message"], "repo not found");
    }

    #[test]
    fn test_app_error_github_serializes() {
        let err = AppError::github(anyhow::anyhow!("GitHub API returned 401: Unauthorized"));
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["kind"], "github");
        assert_eq!(json["message"], "GitHub API returned 401: Unauthorized");
    }

    #[test]
    fn test_app_error_kind_variants_serialize() {
        for (kind, expected) in [
            (ErrorKind::Git, "git"),
            (ErrorKind::GitHub, "github"),
        ] {
            let json = serde_json::to_value(&kind).unwrap();
            assert_eq!(json, expected);
        }
    }

    #[test]
    fn test_app_error_display() {
        let err = AppError::git(anyhow::anyhow!("something went wrong"));
        assert_eq!(err.to_string(), "something went wrong");
    }

    #[test]
    fn test_app_error_preserves_context_chain() {
        let inner = anyhow::anyhow!("disk I/O error")
            .context("Failed to open repository at /tmp/test");
        let err = AppError::git(inner);
        // anyhow の {:#} フォーマットでコンテキストチェーンが保持される
        assert!(err.message.contains("Failed to open repository"));
        assert!(err.message.contains("disk I/O error"));
    }
}
