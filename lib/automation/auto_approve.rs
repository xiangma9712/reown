use serde::{Deserialize, Serialize};

use crate::analysis::{AnalysisResult, RiskLevel};
use crate::config::{AutoApproveMaxRisk, AutomationConfig};
use crate::github::pull_request::{submit_review, ReviewEvent};

/// approve対象PRの候補
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoApproveCandidate {
    /// PR番号
    pub pr_number: u64,
    /// リスクレベル
    pub risk_level: RiskLevel,
    /// approve対象になった理由
    pub reason: String,
}

/// 個別PRのapprove実行結果
#[derive(Debug, Clone, Serialize)]
pub struct ApproveOutcome {
    /// PR番号
    pub pr_number: u64,
    /// 成功したかどうか
    pub success: bool,
    /// エラーメッセージ（失敗時のみ）
    pub error: Option<String>,
}

/// 自動approve実行の全体結果
#[derive(Debug, Clone, Serialize)]
pub struct AutoApproveResult {
    /// 各PRのapprove結果
    pub outcomes: Vec<ApproveOutcome>,
}

/// リスクレベルが設定の最大リスクレベル以下かどうかを判定する
fn risk_within_threshold(risk: &RiskLevel, max_risk: &AutoApproveMaxRisk) -> bool {
    match max_risk {
        AutoApproveMaxRisk::Low => matches!(risk, RiskLevel::Low),
        AutoApproveMaxRisk::Medium => matches!(risk, RiskLevel::Low | RiskLevel::Medium),
    }
}

/// PR分析結果リストと設定に基づき、自動approve対象のPRを判定する
///
/// - `enabled == false` の場合は空リストを返す
/// - 各PRのリスクレベルが `auto_approve_max_risk` 以下の場合にapprove対象とする
pub fn evaluate_auto_approve(
    analyses: &[AnalysisResult],
    config: &AutomationConfig,
) -> Vec<AutoApproveCandidate> {
    if !config.enabled {
        return Vec::new();
    }

    analyses
        .iter()
        .filter(|a| risk_within_threshold(&a.risk.level, &config.auto_approve_max_risk))
        .map(|a| AutoApproveCandidate {
            pr_number: a.pr_number,
            risk_level: a.risk.level.clone(),
            reason: format!(
                "リスクレベル {:?} は自動approve閾値 {:?} 以下",
                a.risk.level, config.auto_approve_max_risk
            ),
        })
        .collect()
}

/// approve対象PRリストに対して実際にGitHub APIでAPPROVEレビューを送信する
pub async fn execute_auto_approve(
    candidates: &[AutoApproveCandidate],
    owner: &str,
    repo: &str,
    token: &str,
) -> AutoApproveResult {
    let mut outcomes = Vec::new();

    for candidate in candidates {
        let body = format!(
            "自動approve（リスクレベル: {:?}）\n\n{}",
            candidate.risk_level, candidate.reason
        );

        match submit_review(
            owner,
            repo,
            candidate.pr_number,
            ReviewEvent::Approve,
            &body,
            token,
        )
        .await
        {
            Ok(()) => {
                outcomes.push(ApproveOutcome {
                    pr_number: candidate.pr_number,
                    success: true,
                    error: None,
                });
            }
            Err(e) => {
                outcomes.push(ApproveOutcome {
                    pr_number: candidate.pr_number,
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    AutoApproveResult { outcomes }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::{AnalysisResult, AnalysisSummary, RiskScore};

    fn make_analysis(pr_number: u64, level: RiskLevel, score: u32) -> AnalysisResult {
        AnalysisResult {
            pr_number,
            risk: RiskScore {
                score,
                level,
                factors: vec![],
            },
            files: vec![],
            summary: AnalysisSummary {
                total_files: 1,
                total_additions: 10,
                total_deletions: 0,
                has_test_changes: false,
                categories: vec![],
            },
        }
    }

    #[test]
    fn test_enabled_false_returns_empty() {
        let analyses = vec![
            make_analysis(1, RiskLevel::Low, 5),
            make_analysis(2, RiskLevel::Medium, 30),
        ];
        let config = AutomationConfig {
            enabled: false,
            auto_approve_max_risk: AutoApproveMaxRisk::Medium,
            ..Default::default()
        };

        let candidates = evaluate_auto_approve(&analyses, &config);
        assert!(candidates.is_empty());
    }

    #[test]
    fn test_max_risk_low_only_low_approved() {
        let analyses = vec![
            make_analysis(1, RiskLevel::Low, 5),
            make_analysis(2, RiskLevel::Medium, 30),
            make_analysis(3, RiskLevel::High, 70),
        ];
        let config = AutomationConfig {
            enabled: true,
            auto_approve_max_risk: AutoApproveMaxRisk::Low,
            ..Default::default()
        };

        let candidates = evaluate_auto_approve(&analyses, &config);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].pr_number, 1);
        assert_eq!(candidates[0].risk_level, RiskLevel::Low);
    }

    #[test]
    fn test_max_risk_medium_low_and_medium_approved() {
        let analyses = vec![
            make_analysis(1, RiskLevel::Low, 5),
            make_analysis(2, RiskLevel::Medium, 30),
            make_analysis(3, RiskLevel::High, 70),
        ];
        let config = AutomationConfig {
            enabled: true,
            auto_approve_max_risk: AutoApproveMaxRisk::Medium,
            ..Default::default()
        };

        let candidates = evaluate_auto_approve(&analyses, &config);
        assert_eq!(candidates.len(), 2);
        assert_eq!(candidates[0].pr_number, 1);
        assert_eq!(candidates[1].pr_number, 2);
    }

    #[test]
    fn test_high_risk_excluded() {
        let analyses = vec![
            make_analysis(1, RiskLevel::High, 70),
            make_analysis(2, RiskLevel::High, 90),
        ];
        let config = AutomationConfig {
            enabled: true,
            auto_approve_max_risk: AutoApproveMaxRisk::Medium,
            ..Default::default()
        };

        let candidates = evaluate_auto_approve(&analyses, &config);
        assert!(candidates.is_empty());
    }

    #[test]
    fn test_empty_analyses_returns_empty() {
        let config = AutomationConfig {
            enabled: true,
            auto_approve_max_risk: AutoApproveMaxRisk::Medium,
            ..Default::default()
        };

        let candidates = evaluate_auto_approve(&[], &config);
        assert!(candidates.is_empty());
    }

    #[test]
    fn test_candidate_has_reason() {
        let analyses = vec![make_analysis(1, RiskLevel::Low, 5)];
        let config = AutomationConfig {
            enabled: true,
            auto_approve_max_risk: AutoApproveMaxRisk::Low,
            ..Default::default()
        };

        let candidates = evaluate_auto_approve(&analyses, &config);
        assert_eq!(candidates.len(), 1);
        assert!(!candidates[0].reason.is_empty());
    }

    #[test]
    fn test_risk_within_threshold() {
        // Low threshold
        assert!(risk_within_threshold(
            &RiskLevel::Low,
            &AutoApproveMaxRisk::Low
        ));
        assert!(!risk_within_threshold(
            &RiskLevel::Medium,
            &AutoApproveMaxRisk::Low
        ));
        assert!(!risk_within_threshold(
            &RiskLevel::High,
            &AutoApproveMaxRisk::Low
        ));

        // Medium threshold
        assert!(risk_within_threshold(
            &RiskLevel::Low,
            &AutoApproveMaxRisk::Medium
        ));
        assert!(risk_within_threshold(
            &RiskLevel::Medium,
            &AutoApproveMaxRisk::Medium
        ));
        assert!(!risk_within_threshold(
            &RiskLevel::High,
            &AutoApproveMaxRisk::Medium
        ));
    }

    #[test]
    fn test_candidate_serializes() {
        let candidate = AutoApproveCandidate {
            pr_number: 42,
            risk_level: RiskLevel::Low,
            reason: "低リスク".to_string(),
        };
        let json = serde_json::to_value(&candidate).unwrap();
        assert_eq!(json["pr_number"], 42);
        assert_eq!(json["risk_level"], "Low");
        assert_eq!(json["reason"], "低リスク");
    }

    #[test]
    fn test_approve_outcome_serializes() {
        let outcome = ApproveOutcome {
            pr_number: 10,
            success: true,
            error: None,
        };
        let json = serde_json::to_value(&outcome).unwrap();
        assert_eq!(json["pr_number"], 10);
        assert_eq!(json["success"], true);
        assert!(json["error"].is_null());

        let outcome_err = ApproveOutcome {
            pr_number: 11,
            success: false,
            error: Some("API error".to_string()),
        };
        let json_err = serde_json::to_value(&outcome_err).unwrap();
        assert_eq!(json_err["success"], false);
        assert_eq!(json_err["error"], "API error");
    }

    #[test]
    fn test_auto_approve_result_serializes() {
        let result = AutoApproveResult {
            outcomes: vec![
                ApproveOutcome {
                    pr_number: 1,
                    success: true,
                    error: None,
                },
                ApproveOutcome {
                    pr_number: 2,
                    success: false,
                    error: Some("失敗".to_string()),
                },
            ],
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["outcomes"].as_array().unwrap().len(), 2);
    }
}
