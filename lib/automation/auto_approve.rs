use serde::{Deserialize, Serialize};

use tracing::warn;

use crate::analysis::{AnalysisResult, ChangeCategory, RiskFactor, RiskLevel};
use crate::config::{AutoApproveMaxRisk, AutomationConfig};
use crate::github::pull_request::{GitHubClient, ReviewEvent};

/// approve対象PRの候補
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoApproveCandidate {
    /// PR番号
    pub pr_number: u64,
    /// リスクレベル
    pub risk_level: RiskLevel,
    /// リスクスコア（0〜100）
    ///
    /// Tauri IPC経由でフロントエンドからデシリアライズされる際、省略可能にするため `default` を指定
    #[serde(default)]
    pub risk_score: u32,
    /// 変更カテゴリ一覧
    ///
    /// Tauri IPC経由でフロントエンドからデシリアライズされる際、省略可能にするため `default` を指定
    #[serde(default)]
    pub categories: Vec<ChangeCategory>,
    /// 主要リスク要因の内訳
    ///
    /// Tauri IPC経由でフロントエンドからデシリアライズされる際、省略可能にするため `default` を指定
    #[serde(default)]
    pub factors: Vec<RiskFactor>,
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
        .map(|a| {
            let categories: Vec<ChangeCategory> = a
                .summary
                .categories
                .iter()
                .map(|c| c.category.clone())
                .collect();
            AutoApproveCandidate {
                pr_number: a.pr_number,
                risk_level: a.risk.level.clone(),
                risk_score: a.risk.score,
                categories,
                factors: a.risk.factors.clone(),
                reason: format!(
                    "リスクレベル {:?} は自動approve閾値 {:?} 以下",
                    a.risk.level, config.auto_approve_max_risk
                ),
            }
        })
        .collect()
}

/// approve対象のリスク情報を含むコメント本文を構築する
fn build_approve_comment(candidate: &AutoApproveCandidate) -> String {
    let categories_str = if candidate.categories.is_empty() {
        "None".to_string()
    } else {
        candidate
            .categories
            .iter()
            .map(|c| format!("{:?}", c))
            .collect::<Vec<_>>()
            .join(", ")
    };

    let factors_str = if candidate.factors.is_empty() {
        String::new()
    } else {
        let items: Vec<String> = candidate
            .factors
            .iter()
            .map(|f| format!("- **{}** (+{}) — {}", f.name, f.score, f.description))
            .collect();
        format!("\nFactors:\n{}", items.join("\n"))
    };

    format!(
        "\u{1f916} Auto-approved by reown\n\
         Risk: {:?} (score: {}/100)\n\
         Categories: {}{}",
        candidate.risk_level, candidate.risk_score, categories_str, factors_str
    )
}

/// approve対象PRリストに対して実際にGitHub APIでAPPROVEレビューを送信し、ラベルを付与する
pub async fn execute_auto_approve(
    candidates: &[AutoApproveCandidate],
    owner: &str,
    repo: &str,
    token: &str,
    config: &AutomationConfig,
    client: &GitHubClient,
) -> AutoApproveResult {
    let mut outcomes = Vec::new();

    for candidate in candidates {
        let body = build_approve_comment(candidate);

        match client
            .submit_review(
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
                // ラベルを付与（失敗してもapprove自体は成功扱い）
                if let Err(e) = client
                    .add_labels(
                        owner,
                        repo,
                        candidate.pr_number,
                        std::slice::from_ref(&config.auto_approve_label),
                        token,
                    )
                    .await
                {
                    warn!(
                        pr_number = candidate.pr_number,
                        error = %e,
                        "ラベル付与に失敗"
                    );
                }

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
    use crate::analysis::{AnalysisResult, AnalysisSummary, CategoryCount, RiskFactor, RiskScore};

    fn make_analysis(pr_number: u64, level: RiskLevel, score: u32) -> AnalysisResult {
        make_analysis_with_categories(pr_number, level, score, vec![])
    }

    fn make_analysis_with_categories(
        pr_number: u64,
        level: RiskLevel,
        score: u32,
        categories: Vec<CategoryCount>,
    ) -> AnalysisResult {
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
                categories,
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
            risk_score: 15,
            categories: vec![ChangeCategory::Test, ChangeCategory::Documentation],
            factors: vec![RiskFactor {
                name: "file_count".to_string(),
                score: 5,
                description: "2ファイルが変更されています".to_string(),
            }],
            reason: "低リスク".to_string(),
        };
        let json = serde_json::to_value(&candidate).unwrap();
        assert_eq!(json["pr_number"], 42);
        assert_eq!(json["risk_level"], "Low");
        assert_eq!(json["risk_score"], 15);
        assert_eq!(json["categories"].as_array().unwrap().len(), 2);
        assert_eq!(json["factors"].as_array().unwrap().len(), 1);
        assert_eq!(json["factors"][0]["name"], "file_count");
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

    #[test]
    fn test_candidate_has_risk_score_and_categories() {
        let analyses = vec![make_analysis_with_categories(
            1,
            RiskLevel::Low,
            15,
            vec![
                CategoryCount {
                    category: ChangeCategory::Test,
                    count: 2,
                },
                CategoryCount {
                    category: ChangeCategory::Documentation,
                    count: 1,
                },
            ],
        )];
        let config = AutomationConfig {
            enabled: true,
            auto_approve_max_risk: AutoApproveMaxRisk::Low,
            ..Default::default()
        };

        let candidates = evaluate_auto_approve(&analyses, &config);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].risk_score, 15);
        assert_eq!(candidates[0].categories.len(), 2);
        assert_eq!(candidates[0].categories[0], ChangeCategory::Test);
        assert_eq!(candidates[0].categories[1], ChangeCategory::Documentation);
        // factors: vec![] が make_analysis_with_categories で設定されているため空
        assert!(candidates[0].factors.is_empty());
    }

    #[test]
    fn test_candidate_has_factors_from_analysis() {
        let mut analysis = make_analysis(1, RiskLevel::Low, 10);
        analysis.risk.factors = vec![
            RiskFactor {
                name: "file_count".to_string(),
                score: 5,
                description: "3ファイルが変更されています".to_string(),
            },
            RiskFactor {
                name: "line_count".to_string(),
                score: 5,
                description: "合計20行の変更（+15 / -5）".to_string(),
            },
        ];
        let config = AutomationConfig {
            enabled: true,
            auto_approve_max_risk: AutoApproveMaxRisk::Low,
            ..Default::default()
        };

        let candidates = evaluate_auto_approve(&[analysis], &config);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].factors.len(), 2);
        assert_eq!(candidates[0].factors[0].name, "file_count");
        assert_eq!(candidates[0].factors[0].score, 5);
        assert_eq!(candidates[0].factors[1].name, "line_count");
    }

    #[test]
    fn test_build_approve_comment_with_categories() {
        let candidate = AutoApproveCandidate {
            pr_number: 42,
            risk_level: RiskLevel::Low,
            risk_score: 15,
            categories: vec![ChangeCategory::Test, ChangeCategory::Documentation],
            factors: vec![
                RiskFactor {
                    name: "file_count".to_string(),
                    score: 10,
                    description: "5ファイルが変更されています".to_string(),
                },
                RiskFactor {
                    name: "line_count".to_string(),
                    score: 5,
                    description: "合計50行の変更（+30 / -20）".to_string(),
                },
            ],
            reason: "低リスク".to_string(),
        };

        let comment = build_approve_comment(&candidate);
        assert!(comment.contains("Auto-approved by reown"));
        assert!(comment.contains("Risk: Low (score: 15/100)"));
        assert!(comment.contains("Categories: Test, Documentation"));
        assert!(comment.contains("Factors:"));
        assert!(comment.contains("**file_count** (+10)"));
        assert!(comment.contains("5ファイルが変更されています"));
        assert!(comment.contains("**line_count** (+5)"));
    }

    #[test]
    fn test_build_approve_comment_no_categories() {
        let candidate = AutoApproveCandidate {
            pr_number: 1,
            risk_level: RiskLevel::Low,
            risk_score: 5,
            categories: vec![],
            factors: vec![],
            reason: "テスト".to_string(),
        };

        let comment = build_approve_comment(&candidate);
        assert!(comment.contains("Categories: None"));
        assert!(!comment.contains("Factors:"));
    }

    #[test]
    fn test_build_approve_comment_medium_risk() {
        let candidate = AutoApproveCandidate {
            pr_number: 10,
            risk_level: RiskLevel::Medium,
            risk_score: 40,
            categories: vec![ChangeCategory::Logic],
            factors: vec![RiskFactor {
                name: "no_tests".to_string(),
                score: 15,
                description: "ロジック変更がありますが、テストの追加・更新がありません".to_string(),
            }],
            reason: "テスト".to_string(),
        };

        let comment = build_approve_comment(&candidate);
        assert!(comment.contains("Risk: Medium (score: 40/100)"));
        assert!(comment.contains("Categories: Logic"));
        assert!(comment.contains("**no_tests** (+15)"));
    }

    #[test]
    fn test_auto_approve_label_default() {
        let config = AutomationConfig::default();
        assert_eq!(config.auto_approve_label, "auto-approved");
    }

    #[test]
    fn test_auto_approve_label_custom() {
        let config = AutomationConfig {
            auto_approve_label: "bot-approved".to_string(),
            ..Default::default()
        };
        assert_eq!(config.auto_approve_label, "bot-approved");
    }
}
