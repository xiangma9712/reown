use serde::Serialize;

use crate::config::AutomationConfig;
use crate::github::pull_request::{enable_auto_merge, MergeMethod};

use super::auto_approve::{execute_auto_approve, ApproveOutcome, AutoApproveCandidate};

/// auto-mergeの有効化結果
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub enum AutoMergeStatus {
    /// auto-merge有効化成功
    Enabled,
    /// auto-merge有効化失敗
    Failed(String),
    /// auto-merge無効設定のためスキップ
    Skipped,
    /// approve失敗のためスキップ
    SkippedDueToApproveFail,
}

/// 個別PRのapprove + auto-merge結果
#[derive(Debug, Clone, Serialize)]
pub struct ApproveWithMergeOutcome {
    /// PR番号
    pub pr_number: u64,
    /// approve成功したかどうか
    pub approve_success: bool,
    /// approveエラーメッセージ（失敗時のみ）
    pub approve_error: Option<String>,
    /// auto-mergeステータス
    pub auto_merge_status: AutoMergeStatus,
}

/// 統合実行の全体結果
#[derive(Debug, Clone, Serialize)]
pub struct AutoApproveWithMergeResult {
    /// 各PRの結果
    pub outcomes: Vec<ApproveWithMergeOutcome>,
    /// 使用されたマージ方法
    pub merge_method: crate::config::MergeMethod,
}

/// approve成功後にauto-mergeを有効化する統合オーケストレーション関数
///
/// - `execute_auto_approve()` を呼び出し、成功したPRに対して `enable_auto_merge()` を呼び出す
/// - `AutomationConfig.enable_auto_merge` が false の場合は merge ステップをスキップ
/// - auto-merge の有効化に失敗しても approve は取り消さない
pub async fn execute_auto_approve_with_merge(
    candidates: &[AutoApproveCandidate],
    owner: &str,
    repo: &str,
    token: &str,
    config: &AutomationConfig,
) -> AutoApproveWithMergeResult {
    let approve_result = execute_auto_approve(candidates, owner, repo, token).await;

    let mut outcomes = Vec::new();

    for approve_outcome in &approve_result.outcomes {
        let auto_merge_status = determine_and_execute_merge(
            approve_outcome,
            config,
            owner,
            repo,
            token,
        )
        .await;

        outcomes.push(ApproveWithMergeOutcome {
            pr_number: approve_outcome.pr_number,
            approve_success: approve_outcome.success,
            approve_error: approve_outcome.error.clone(),
            auto_merge_status,
        });
    }

    AutoApproveWithMergeResult {
        outcomes,
        merge_method: config.auto_merge_method.clone(),
    }
}

/// 個別PRに対してauto-mergeを実行するかどうか判定し、必要に応じて実行する
async fn determine_and_execute_merge(
    approve_outcome: &ApproveOutcome,
    config: &AutomationConfig,
    owner: &str,
    repo: &str,
    token: &str,
) -> AutoMergeStatus {
    if !approve_outcome.success {
        return AutoMergeStatus::SkippedDueToApproveFail;
    }

    if !config.enable_auto_merge {
        return AutoMergeStatus::Skipped;
    }

    let merge_method = match &config.auto_merge_method {
        crate::config::MergeMethod::Merge => MergeMethod::Merge,
        crate::config::MergeMethod::Squash => MergeMethod::Squash,
        crate::config::MergeMethod::Rebase => MergeMethod::Rebase,
    };

    match enable_auto_merge(
        token,
        owner,
        repo,
        approve_outcome.pr_number,
        merge_method,
    )
    .await
    {
        Ok(()) => AutoMergeStatus::Enabled,
        Err(e) => AutoMergeStatus::Failed(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::RiskLevel;
    use crate::config::{AutoApproveMaxRisk, MergeMethod as ConfigMergeMethod};

    fn make_candidate(pr_number: u64) -> AutoApproveCandidate {
        AutoApproveCandidate {
            pr_number,
            risk_level: RiskLevel::Low,
            reason: "テスト用候補".to_string(),
        }
    }

    fn config_with_merge(enable_merge: bool) -> AutomationConfig {
        AutomationConfig {
            enabled: true,
            auto_approve_max_risk: AutoApproveMaxRisk::Medium,
            enable_auto_merge: enable_merge,
            auto_merge_method: ConfigMergeMethod::Squash,
        }
    }

    #[test]
    fn test_auto_merge_status_serializes() {
        let enabled = serde_json::to_value(&AutoMergeStatus::Enabled).unwrap();
        assert_eq!(enabled, "Enabled");

        let skipped = serde_json::to_value(&AutoMergeStatus::Skipped).unwrap();
        assert_eq!(skipped, "Skipped");

        let skip_approve = serde_json::to_value(&AutoMergeStatus::SkippedDueToApproveFail).unwrap();
        assert_eq!(skip_approve, "SkippedDueToApproveFail");

        let failed = serde_json::to_value(AutoMergeStatus::Failed("error".to_string())).unwrap();
        assert!(failed.is_object() || failed.is_string());
    }

    #[test]
    fn test_approve_with_merge_outcome_serializes() {
        let outcome = ApproveWithMergeOutcome {
            pr_number: 42,
            approve_success: true,
            approve_error: None,
            auto_merge_status: AutoMergeStatus::Enabled,
        };
        let json = serde_json::to_value(&outcome).unwrap();
        assert_eq!(json["pr_number"], 42);
        assert_eq!(json["approve_success"], true);
        assert!(json["approve_error"].is_null());
        assert_eq!(json["auto_merge_status"], "Enabled");
    }

    #[test]
    fn test_approve_with_merge_result_serializes() {
        let result = AutoApproveWithMergeResult {
            outcomes: vec![ApproveWithMergeOutcome {
                pr_number: 1,
                approve_success: true,
                approve_error: None,
                auto_merge_status: AutoMergeStatus::Skipped,
            }],
            merge_method: ConfigMergeMethod::Squash,
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["outcomes"].as_array().unwrap().len(), 1);
        assert_eq!(json["merge_method"], "Squash");
    }

    #[test]
    fn test_outcome_with_approve_failure() {
        let outcome = ApproveWithMergeOutcome {
            pr_number: 10,
            approve_success: false,
            approve_error: Some("API error".to_string()),
            auto_merge_status: AutoMergeStatus::SkippedDueToApproveFail,
        };
        let json = serde_json::to_value(&outcome).unwrap();
        assert_eq!(json["approve_success"], false);
        assert_eq!(json["approve_error"], "API error");
        assert_eq!(json["auto_merge_status"], "SkippedDueToApproveFail");
    }

    #[test]
    fn test_outcome_with_merge_failure() {
        let outcome = ApproveWithMergeOutcome {
            pr_number: 20,
            approve_success: true,
            approve_error: None,
            auto_merge_status: AutoMergeStatus::Failed("merge failed".to_string()),
        };
        let json = serde_json::to_value(&outcome).unwrap();
        assert_eq!(json["approve_success"], true);
    }

    #[test]
    fn test_determine_merge_skips_on_approve_fail() {
        let outcome = ApproveOutcome {
            pr_number: 1,
            success: false,
            error: Some("fail".to_string()),
        };
        let config = config_with_merge(true);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let status = rt.block_on(determine_and_execute_merge(
            &outcome, &config, "owner", "repo", "token",
        ));
        assert_eq!(status, AutoMergeStatus::SkippedDueToApproveFail);
    }

    #[test]
    fn test_determine_merge_skips_when_disabled() {
        let outcome = ApproveOutcome {
            pr_number: 1,
            success: true,
            error: None,
        };
        let config = config_with_merge(false);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let status = rt.block_on(determine_and_execute_merge(
            &outcome, &config, "owner", "repo", "token",
        ));
        assert_eq!(status, AutoMergeStatus::Skipped);
    }

    // Note: execute_auto_approve_with_merge のフルテストはGitHub APIモックが必要なため
    // 統合テストとして後日追加。ここではロジック分岐のユニットテストのみ。

    #[test]
    fn test_candidate_helper() {
        let candidate = make_candidate(42);
        assert_eq!(candidate.pr_number, 42);
        assert_eq!(candidate.risk_level, RiskLevel::Low);
    }
}
