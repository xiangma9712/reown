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

#[tauri::command]
fn list_enriched_branches(
    repo_path: String,
    pull_requests: Vec<reown::github::PrInfo>,
) -> Result<Vec<reown::git::EnrichedBranchInfo>, AppError> {
    reown::git::branch::list_enriched_branches(&repo_path, &pull_requests).map_err(AppError::git)
}

// ── Worktree commands ───────────────────────────────────────────────────────

#[tauri::command]
fn list_worktrees(repo_path: String) -> Result<Vec<reown::git::worktree::WorktreeInfo>, AppError> {
    reown::git::worktree::list_worktrees(&repo_path).map_err(AppError::git)
}

#[tauri::command]
fn add_worktree(repo_path: String, worktree_path: String, branch: String) -> Result<(), AppError> {
    reown::git::worktree::add_worktree(&repo_path, &worktree_path, &branch).map_err(AppError::git)
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

#[tauri::command]
fn diff_branches(
    repo_path: String,
    base_ref: String,
    head_ref: String,
) -> Result<Vec<reown::git::diff::FileDiff>, AppError> {
    reown::git::diff::diff_branches(&repo_path, &base_ref, &head_ref).map_err(AppError::git)
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
) -> Result<Vec<reown::analysis::CategorizedFileDiff>, AppError> {
    let diffs =
        reown::github::pull_request::get_pull_request_files(&owner, &repo, pr_number, &token)
            .await
            .map_err(AppError::github)?;
    Ok(reown::analysis::categorize_diffs(diffs))
}

#[tauri::command]
async fn list_pr_commits(
    owner: String,
    repo: String,
    pr_number: u64,
    token: String,
) -> Result<Vec<reown::github::CommitInfo>, AppError> {
    reown::github::pull_request::list_pr_commits(&owner, &repo, pr_number, &token)
        .await
        .map_err(AppError::github)
}

#[tauri::command]
async fn submit_pr_review(
    owner: String,
    repo: String,
    pr_number: u64,
    event: reown::github::ReviewEvent,
    body: String,
    token: String,
) -> Result<(), AppError> {
    reown::github::pull_request::submit_review(&owner, &repo, pr_number, event, &body, &token)
        .await
        .map_err(AppError::github)
}

#[tauri::command]
async fn enable_pr_auto_merge(
    owner: String,
    repo: String,
    pr_number: u64,
    merge_method: reown::github::MergeMethod,
    token: String,
) -> Result<(), AppError> {
    reown::github::pull_request::enable_auto_merge(&token, &owner, &repo, pr_number, merge_method)
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
fn remove_repository(app_handle: tauri::AppHandle, path: String) -> Result<(), AppError> {
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
        .ok_or_else(|| AppError::analysis(anyhow::anyhow!("PR #{pr_number} not found")))?;

    let diffs =
        reown::github::pull_request::get_pull_request_files(&owner, &repo, pr_number, &token)
            .await
            .map_err(AppError::github)?;

    Ok(reown::analysis::analyze_pr_risk(&pr, &diffs))
}

#[tauri::command]
async fn analyze_pr_risk_with_llm(
    owner: String,
    repo: String,
    pr_number: u64,
    token: String,
    app_handle: tauri::AppHandle,
) -> Result<reown::analysis::HybridAnalysisResult, AppError> {
    let llm_client = build_llm_client(&app_handle)?;

    let prs = reown::github::pull_request::list_pull_requests(&owner, &repo, &token)
        .await
        .map_err(AppError::github)?;

    let pr = prs
        .into_iter()
        .find(|p| p.number == pr_number)
        .ok_or_else(|| AppError::analysis(anyhow::anyhow!("PR #{pr_number} not found")))?;

    let diffs =
        reown::github::pull_request::get_pull_request_files(&owner, &repo, pr_number, &token)
            .await
            .map_err(AppError::github)?;

    reown::analysis::analyze_pr_with_llm(&pr, &diffs, &llm_client)
        .await
        .map_err(AppError::llm)
}

// ── LLM helpers ─────────────────────────────────────────────────────────────

/// 保存済みの設定からLlmClientを構築する
fn build_llm_client(
    app_handle: &tauri::AppHandle,
) -> Result<reown::llm::client::LlmClient, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::llm(anyhow::anyhow!("{e}")))?;
    let config_path = reown::config::default_config_path(&app_data_dir);
    let config = reown::config::load_config(&config_path).map_err(AppError::llm)?;
    let llm_config = config.llm;

    let api_key = if llm_config.llm_api_key_stored {
        reown::config::load_llm_api_key().ok()
    } else {
        None
    };

    Ok(reown::llm::client::LlmClient::with_api_base(
        api_key,
        llm_config.llm_endpoint,
        llm_config.llm_model,
    ))
}

// ── LLM commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn summarize_pull_request(
    owner: String,
    repo: String,
    pr_number: u64,
    token: String,
    app_handle: tauri::AppHandle,
) -> Result<reown::llm::summary::PrSummary, AppError> {
    let llm_client = build_llm_client(&app_handle)?;
    reown::llm::summary::summarize_pr(&owner, &repo, pr_number, &token, &llm_client)
        .await
        .map_err(AppError::llm)
}

#[tauri::command]
async fn check_pr_consistency(
    owner: String,
    repo: String,
    pr_number: u64,
    token: String,
    app_handle: tauri::AppHandle,
) -> Result<reown::llm::summary::ConsistencyResult, AppError> {
    let llm_client = build_llm_client(&app_handle)?;
    reown::llm::summary::check_pr_consistency(&owner, &repo, pr_number, &token, &llm_client)
        .await
        .map_err(AppError::llm)
}

// ── LLM connection test ─────────────────────────────────────────────────────

#[tauri::command]
async fn test_llm_connection(
    endpoint: String,
    model: String,
    api_key: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    // 入力されたAPIキーがなければ、保存済みのキーを使う
    let resolved_key = match api_key {
        Some(ref k) if !k.is_empty() => Some(k.clone()),
        _ => {
            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .map_err(|e| AppError::llm(anyhow::anyhow!("{e}")))?;
            let config_path = reown::config::default_config_path(&app_data_dir);
            let config = reown::config::load_config(&config_path).map_err(AppError::llm)?;
            if config.llm.llm_api_key_stored {
                reown::config::load_llm_api_key().ok()
            } else {
                None
            }
        }
    };

    let client = reown::llm::client::LlmClient::with_api_base(resolved_key, endpoint, model);
    client
        .chat("Say hello in one word.")
        .await
        .map_err(AppError::llm)?;
    Ok(())
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
fn load_app_config(app_handle: tauri::AppHandle) -> Result<reown::config::AppConfig, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let config_path = reown::config::default_config_path(&app_data_dir);
    reown::config::load_config(&config_path).map_err(AppError::storage)
}

// ── LLM Config commands ────────────────────────────────────────────────────

#[tauri::command]
fn save_llm_config(
    app_handle: tauri::AppHandle,
    llm_config: reown::config::LlmConfig,
) -> Result<(), AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let config_path = reown::config::default_config_path(&app_data_dir);
    let mut config = reown::config::load_config(&config_path).map_err(AppError::storage)?;
    config.llm = llm_config;
    reown::config::save_config(&config_path, &config).map_err(AppError::storage)
}

#[tauri::command]
fn load_llm_config(app_handle: tauri::AppHandle) -> Result<reown::config::LlmConfig, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let config_path = reown::config::default_config_path(&app_data_dir);
    let config = reown::config::load_config(&config_path).map_err(AppError::storage)?;
    Ok(config.llm)
}

#[tauri::command]
fn save_llm_api_key(api_key: String) -> Result<(), AppError> {
    reown::config::save_llm_api_key(&api_key).map_err(AppError::storage)
}

#[tauri::command]
fn delete_llm_api_key() -> Result<(), AppError> {
    reown::config::delete_llm_api_key().map_err(AppError::storage)
}

// ── Automation Config commands ───────────────────────────────────────────────

#[tauri::command]
fn save_automation_config(
    app_handle: tauri::AppHandle,
    automation_config: reown::config::AutomationConfig,
) -> Result<(), AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let config_path = reown::config::default_config_path(&app_data_dir);
    let mut config = reown::config::load_config(&config_path).map_err(AppError::storage)?;
    config.automation = automation_config;
    reown::config::save_config(&config_path, &config).map_err(AppError::storage)
}

#[tauri::command]
fn load_automation_config(
    app_handle: tauri::AppHandle,
) -> Result<reown::config::AutomationConfig, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let config_path = reown::config::default_config_path(&app_data_dir);
    let config = reown::config::load_config(&config_path).map_err(AppError::storage)?;
    Ok(config.automation)
}

// ── Automation commands ───────────────────────────────────────────────────────

#[tauri::command]
async fn evaluate_auto_approve_candidates(
    owner: String,
    repo: String,
    token: String,
    app_handle: tauri::AppHandle,
) -> Result<Vec<reown::automation::AutoApproveCandidate>, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let config_path = reown::config::default_config_path(&app_data_dir);
    let config = reown::config::load_config(&config_path).map_err(AppError::storage)?;

    let prs = reown::github::pull_request::list_pull_requests(&owner, &repo, &token)
        .await
        .map_err(AppError::github)?;

    let mut analyses = Vec::new();
    for pr in &prs {
        let diffs =
            reown::github::pull_request::get_pull_request_files(&owner, &repo, pr.number, &token)
                .await
                .map_err(AppError::github)?;
        analyses.push(reown::analysis::analyze_pr_risk(pr, &diffs));
    }

    Ok(reown::automation::evaluate_auto_approve(
        &analyses,
        &config.automation,
    ))
}

#[tauri::command]
async fn run_auto_approve(
    owner: String,
    repo: String,
    token: String,
    app_handle: tauri::AppHandle,
) -> Result<reown::automation::AutoApproveResult, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let config_path = reown::config::default_config_path(&app_data_dir);
    let config = reown::config::load_config(&config_path).map_err(AppError::storage)?;

    let prs = reown::github::pull_request::list_pull_requests(&owner, &repo, &token)
        .await
        .map_err(AppError::github)?;

    let mut analyses = Vec::new();
    for pr in &prs {
        let diffs =
            reown::github::pull_request::get_pull_request_files(&owner, &repo, pr.number, &token)
                .await
                .map_err(AppError::github)?;
        analyses.push(reown::analysis::analyze_pr_risk(pr, &diffs));
    }

    let candidates = reown::automation::evaluate_auto_approve(&analyses, &config.automation);
    Ok(reown::automation::execute_auto_approve(&candidates, &owner, &repo, &token).await)
}

#[tauri::command]
async fn run_auto_approve_with_merge(
    owner: String,
    repo: String,
    token: String,
    candidates: Vec<reown::automation::AutoApproveCandidate>,
    automation_config: reown::config::AutomationConfig,
) -> Result<reown::automation::AutoApproveWithMergeResult, AppError> {
    Ok(reown::automation::execute_auto_approve_with_merge(
        &candidates,
        &owner,
        &repo,
        &token,
        &automation_config,
    )
    .await)
}

// ── TODO extraction commands ─────────────────────────────────────────────────

#[tauri::command]
fn extract_todos(repo_path: String) -> Result<Vec<reown::git::todo::TodoItem>, AppError> {
    reown::git::todo::extract_todos(&repo_path).map_err(AppError::git)
}

// ── Review Pattern commands ──────────────────────────────────────────────────

#[tauri::command]
async fn suggest_review_comments(
    app_handle: tauri::AppHandle,
    owner: String,
    repo: String,
    pr_number: u64,
    token: String,
) -> Result<Vec<reown::analysis::ReviewSuggestion>, AppError> {
    // 1. レビュー履歴を読み込む
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let storage_path = reown::review_history::default_review_history_path(&app_data_dir);
    let records =
        reown::review_history::load_review_history(&storage_path).map_err(AppError::storage)?;

    // 2. レビューパターンを分析する
    let stats = reown::analysis::analyze_review_patterns(&records);

    // 3. PRの情報を取得してリスク分析する
    let prs = reown::github::pull_request::list_pull_requests(&owner, &repo, &token)
        .await
        .map_err(AppError::github)?;

    let pr = prs
        .into_iter()
        .find(|p| p.number == pr_number)
        .ok_or_else(|| AppError::analysis(anyhow::anyhow!("PR #{pr_number} not found")))?;

    let diffs =
        reown::github::pull_request::get_pull_request_files(&owner, &repo, pr_number, &token)
            .await
            .map_err(AppError::github)?;

    let analysis = reown::analysis::analyze_pr_risk(&pr, &diffs);

    // 4. サジェストを生成する
    Ok(reown::analysis::suggest_review_focus(
        &analysis.files,
        &analysis.risk.level,
        &stats,
    ))
}

// ── Review History commands ──────────────────────────────────────────────────

#[tauri::command]
fn list_review_history(
    app_handle: tauri::AppHandle,
) -> Result<Vec<reown::review_history::ReviewRecord>, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let storage_path = reown::review_history::default_review_history_path(&app_data_dir);
    reown::review_history::load_review_history(&storage_path).map_err(AppError::storage)
}

#[tauri::command]
fn add_review_record(
    app_handle: tauri::AppHandle,
    record: reown::review_history::ReviewRecord,
) -> Result<(), AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::storage(anyhow::anyhow!("{e}")))?;
    let storage_path = reown::review_history::default_review_history_path(&app_data_dir);
    reown::review_history::add_review_record(&storage_path, record).map_err(AppError::storage)
}

// ── Main ────────────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_branches,
            list_enriched_branches,
            create_branch,
            switch_branch,
            delete_branch,
            list_worktrees,
            add_worktree,
            diff_workdir,
            diff_commit,
            diff_branches,
            list_pull_requests,
            get_pull_request_files,
            list_pr_commits,
            submit_pr_review,
            enable_pr_auto_merge,
            analyze_pr_risk,
            analyze_pr_risk_with_llm,
            summarize_pull_request,
            check_pr_consistency,
            get_repo_info,
            add_repository,
            list_repositories,
            remove_repository,
            save_app_config,
            load_app_config,
            save_llm_config,
            load_llm_config,
            save_llm_api_key,
            delete_llm_api_key,
            test_llm_connection,
            save_automation_config,
            load_automation_config,
            evaluate_auto_approve_candidates,
            run_auto_approve,
            run_auto_approve_with_merge,
            extract_todos,
            suggest_review_comments,
            list_review_history,
            add_review_record,
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
        for (kind, expected) in [(ErrorKind::Git, "git"), (ErrorKind::GitHub, "github")] {
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
    fn test_auto_approve_candidate_deserializes() {
        let json = serde_json::json!({
            "pr_number": 42,
            "risk_level": "Low",
            "reason": "リスクが低い"
        });
        let candidate: reown::automation::AutoApproveCandidate =
            serde_json::from_value(json).unwrap();
        assert_eq!(candidate.pr_number, 42);
        assert_eq!(candidate.reason, "リスクが低い");
    }

    #[test]
    fn test_auto_approve_with_merge_result_serializes() {
        use reown::automation::{
            ApproveWithMergeOutcome, AutoApproveWithMergeResult, AutoMergeStatus,
        };
        let result = AutoApproveWithMergeResult {
            outcomes: vec![ApproveWithMergeOutcome {
                pr_number: 1,
                approve_success: true,
                approve_error: None,
                auto_merge_status: AutoMergeStatus::Enabled,
            }],
            merge_method: reown::config::MergeMethod::Squash,
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["outcomes"][0]["pr_number"], 1);
        assert_eq!(json["outcomes"][0]["approve_success"], true);
        assert_eq!(json["outcomes"][0]["auto_merge_status"], "Enabled");
        assert_eq!(json["merge_method"], "Squash");
    }

    #[test]
    fn test_app_error_preserves_context_chain() {
        let inner =
            anyhow::anyhow!("disk I/O error").context("Failed to open repository at /tmp/test");
        let err = AppError::git(inner);
        // anyhow の {:#} フォーマットでコンテキストチェーンが保持される
        assert!(err.message.contains("Failed to open repository"));
        assert!(err.message.contains("disk I/O error"));
    }

    // ── テスト用ヘルパー ────────────────────────────────────────────────────

    /// テスト用リポジトリを初期化する（初期コミット付き）
    fn init_test_repo() -> (tempfile::TempDir, git2::Repository) {
        let dir = tempfile::TempDir::new().unwrap();
        let repo = git2::Repository::init(dir.path()).unwrap();

        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test").unwrap();
        config.set_str("user.email", "test@test.com").unwrap();
        config.set_str("init.defaultBranch", "main").unwrap();
        drop(config);

        repo.set_head("refs/heads/main").unwrap();

        std::fs::write(dir.path().join("hello.txt"), "hello\n").unwrap();
        let sig = git2::Signature::now("Test", "test@test.com").unwrap();
        let mut index = repo.index().unwrap();
        index
            .add_path(std::path::Path::new("hello.txt"))
            .unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        {
            let tree = repo.find_tree(tree_id).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
                .unwrap();
        }

        (dir, repo)
    }

    // ── Branch コマンドテスト ──────────────────────────────────────────────

    #[test]
    fn test_cmd_list_branches_ok() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        let branches = super::list_branches(path).unwrap();
        assert_eq!(branches.len(), 1);
        assert!(branches[0].is_head);
        assert_eq!(branches[0].name, "main");
    }

    #[test]
    fn test_cmd_list_branches_invalid_path() {
        let result = super::list_branches("/nonexistent/path/xyz".to_string());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Git));
    }

    #[test]
    fn test_cmd_create_branch_ok() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        super::create_branch(path.clone(), "feature".to_string()).unwrap();
        let branches = super::list_branches(path).unwrap();
        assert!(branches.iter().any(|b| b.name == "feature"));
    }

    #[test]
    fn test_cmd_create_branch_duplicate() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        super::create_branch(path.clone(), "dup".to_string()).unwrap();
        let result = super::create_branch(path, "dup".to_string());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Git));
    }

    #[test]
    fn test_cmd_switch_branch_ok() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        super::create_branch(path.clone(), "feature".to_string()).unwrap();
        super::switch_branch(path.clone(), "feature".to_string()).unwrap();
        let branches = super::list_branches(path).unwrap();
        let feature = branches.iter().find(|b| b.name == "feature").unwrap();
        assert!(feature.is_head);
    }

    #[test]
    fn test_cmd_switch_branch_nonexistent() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        let result = super::switch_branch(path, "nonexistent".to_string());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Git));
    }

    #[test]
    fn test_cmd_delete_branch_ok() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        super::create_branch(path.clone(), "to-delete".to_string()).unwrap();
        super::delete_branch(path.clone(), "to-delete".to_string()).unwrap();
        let branches = super::list_branches(path).unwrap();
        assert!(!branches.iter().any(|b| b.name == "to-delete"));
    }

    #[test]
    fn test_cmd_delete_branch_nonexistent() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        let result = super::delete_branch(path, "nonexistent".to_string());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Git));
    }

    // ── list_enriched_branches コマンドテスト ────────────────────────────

    #[test]
    fn test_cmd_list_enriched_branches_empty_prs() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        super::create_branch(path.clone(), "feature".to_string()).unwrap();
        let enriched = super::list_enriched_branches(path, vec![]).unwrap();
        assert_eq!(enriched.len(), 2);
        for b in &enriched {
            assert!(b.is_local);
            assert!(b.pr_number.is_none());
        }
    }

    #[test]
    fn test_cmd_list_enriched_branches_with_prs() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        super::create_branch(path.clone(), "feature-x".to_string()).unwrap();

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

        let enriched = super::list_enriched_branches(path, prs).unwrap();
        let feature = enriched.iter().find(|b| b.name == "feature-x").unwrap();
        assert_eq!(feature.pr_number, Some(42));
        assert_eq!(feature.pr_title.as_deref(), Some("Add feature X"));
    }

    // ── Worktree コマンドテスト ──────────────────────────────────────────

    #[test]
    fn test_cmd_list_worktrees_ok() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        let wts = super::list_worktrees(path).unwrap();
        assert_eq!(wts.len(), 1);
        assert!(wts[0].is_main);
    }

    #[test]
    fn test_cmd_list_worktrees_invalid_path() {
        let result = super::list_worktrees("/nonexistent/path/xyz".to_string());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Git));
    }

    #[test]
    fn test_cmd_add_worktree_ok() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        let wt_path = dir.path().join("wt-feature");
        super::add_worktree(
            path.clone(),
            wt_path.to_str().unwrap().to_string(),
            "feature".to_string(),
        )
        .unwrap();
        let wts = super::list_worktrees(path).unwrap();
        assert_eq!(wts.len(), 2);
        assert!(wts.iter().any(|w| w.name == "feature"));
    }

    #[test]
    fn test_cmd_add_worktree_invalid_repo_path() {
        let result = super::add_worktree(
            "/nonexistent/path/xyz".to_string(),
            "/tmp/wt".to_string(),
            "branch".to_string(),
        );
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Git));
    }

    // ── Diff コマンドテスト ──────────────────────────────────────────────

    #[test]
    fn test_cmd_diff_workdir_no_changes() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        let diffs = super::diff_workdir(path).unwrap();
        assert!(diffs.is_empty());
    }

    #[test]
    fn test_cmd_diff_workdir_with_changes() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        std::fs::write(dir.path().join("hello.txt"), "hello\nworld\n").unwrap();
        let diffs = super::diff_workdir(path).unwrap();
        assert_eq!(diffs.len(), 1);
        assert_eq!(diffs[0].status, reown::git::diff::FileStatus::Modified);
    }

    #[test]
    fn test_cmd_diff_workdir_invalid_path() {
        let result = super::diff_workdir("/nonexistent/path/xyz".to_string());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Git));
    }

    #[test]
    fn test_cmd_diff_commit_ok() {
        let (dir, repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();

        // 2回目のコミットを作成
        std::fs::write(dir.path().join("hello.txt"), "hello\nworld\n").unwrap();
        let sig = git2::Signature::now("Test", "test@test.com").unwrap();
        let mut index = repo.index().unwrap();
        index
            .add_path(std::path::Path::new("hello.txt"))
            .unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let oid = repo
            .commit(Some("HEAD"), &sig, &sig, "update", &tree, &[&parent])
            .unwrap();

        let diffs = super::diff_commit(path, oid.to_string()).unwrap();
        assert_eq!(diffs.len(), 1);
        assert_eq!(diffs[0].status, reown::git::diff::FileStatus::Modified);
    }

    #[test]
    fn test_cmd_diff_commit_invalid_sha() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        let result = super::diff_commit(path, "invalid_sha_value".to_string());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Git));
    }

    // ── get_repo_info コマンドテスト ──────────────────────────────────────

    #[test]
    fn test_cmd_get_repo_info_ok() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();
        let info = super::get_repo_info(path).unwrap();
        assert!(!info.name.is_empty());
        assert!(!info.path.is_empty());
    }

    #[test]
    fn test_cmd_get_repo_info_invalid_path() {
        let result = super::get_repo_info("/nonexistent/path/xyz".to_string());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Git));
    }

    // ── extract_todos コマンドテスト ──────────────────────────────────────

    #[test]
    fn test_cmd_extract_todos_ok() {
        let (dir, _repo) = init_test_repo();
        let path = dir.path().to_str().unwrap().to_string();

        std::fs::write(
            dir.path().join("main.rs"),
            "fn main() {\n    // TODO: implement this\n}\n",
        )
        .unwrap();

        let items = super::extract_todos(path).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].content, "implement this");
    }

    #[test]
    fn test_cmd_extract_todos_invalid_path() {
        let result = super::extract_todos("/nonexistent/path/xyz".to_string());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Git));
    }
}
