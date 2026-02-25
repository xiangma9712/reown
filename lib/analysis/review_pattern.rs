use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use super::classify::ChangeCategory;
use super::risk::{FileAnalysis, RiskLevel};
use crate::github::ReviewEvent;
use crate::review_history::ReviewRecord;

/// カテゴリ別のレビュー統計
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryStat {
    pub total: usize,
    pub approved: usize,
    pub rejected: usize,
    pub reject_rate: f64,
}

/// リスクレベル別のレビュー統計
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskStat {
    pub total: usize,
    pub approved: usize,
    pub rejected: usize,
    pub reject_rate: f64,
}

/// request_changes が多いファイルパスパターン
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RejectPathPattern {
    pub pattern: String,
    pub reject_count: usize,
}

/// レビューパターン統計
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewPatternStats {
    pub category_stats: HashMap<ChangeCategory, CategoryStat>,
    pub risk_stats: HashMap<RiskLevel, RiskStat>,
    pub reject_path_patterns: Vec<RejectPathPattern>,
    pub total_reviews: usize,
}

/// サジェストの重要度
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SuggestionSeverity {
    Info,
    Warning,
    Alert,
}

/// レビューサジェスト
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewSuggestion {
    /// サジェストメッセージ
    pub message: String,
    /// 重要度
    pub severity: SuggestionSeverity,
    /// どの統計に基づくか
    pub source: String,
}

/// レビュー履歴からパターンを分析する。
///
/// カテゴリ別・リスクレベル別の approve/request_changes 率と、
/// 頻繁に request_changes 対象となるファイルパスパターンを返す。
pub fn analyze_review_patterns(records: &[ReviewRecord]) -> ReviewPatternStats {
    let mut category_stats: HashMap<ChangeCategory, CategoryStat> = HashMap::new();
    let mut risk_stats: HashMap<RiskLevel, RiskStat> = HashMap::new();

    for record in records {
        // リスクレベル別の集計
        let risk_entry = risk_stats
            .entry(record.risk_level.clone())
            .or_insert(RiskStat {
                total: 0,
                approved: 0,
                rejected: 0,
                reject_rate: 0.0,
            });
        risk_entry.total += 1;
        match record.action {
            ReviewEvent::Approve => risk_entry.approved += 1,
            ReviewEvent::RequestChanges => risk_entry.rejected += 1,
        }

        // カテゴリ別の集計（1つのレコードが複数カテゴリを持つ）
        for category in &record.categories {
            let cat_entry = category_stats
                .entry(category.clone())
                .or_insert(CategoryStat {
                    total: 0,
                    approved: 0,
                    rejected: 0,
                    reject_rate: 0.0,
                });
            cat_entry.total += 1;
            match record.action {
                ReviewEvent::Approve => cat_entry.approved += 1,
                ReviewEvent::RequestChanges => cat_entry.rejected += 1,
            }
        }
    }

    // reject_rate を計算
    for stat in category_stats.values_mut() {
        stat.reject_rate = if stat.total > 0 {
            stat.rejected as f64 / stat.total as f64
        } else {
            0.0
        };
    }
    for stat in risk_stats.values_mut() {
        stat.reject_rate = if stat.total > 0 {
            stat.rejected as f64 / stat.total as f64
        } else {
            0.0
        };
    }

    // ファイルパスパターンの集計は ReviewRecord に個別ファイルパス情報がないため、
    // カテゴリ名をパターンとして利用する
    let reject_path_patterns = build_reject_path_patterns(records);

    ReviewPatternStats {
        category_stats,
        risk_stats,
        reject_path_patterns,
        total_reviews: records.len(),
    }
}

/// request_changes されたレコードのカテゴリからパスパターンを推定する。
///
/// ReviewRecord にはファイルパス情報がないため、reject されたカテゴリの
/// 出現回数をパスパターンとして返す。
fn build_reject_path_patterns(records: &[ReviewRecord]) -> Vec<RejectPathPattern> {
    let mut pattern_counts: HashMap<String, usize> = HashMap::new();

    for record in records {
        if record.action == ReviewEvent::RequestChanges {
            for category in &record.categories {
                let pattern = format!("{:?}", category);
                *pattern_counts.entry(pattern).or_insert(0) += 1;
            }
        }
    }

    let mut patterns: Vec<RejectPathPattern> = pattern_counts
        .into_iter()
        .map(|(pattern, reject_count)| RejectPathPattern {
            pattern,
            reject_count,
        })
        .collect();

    // reject_count の降順でソート
    patterns.sort_by(|a, b| b.reject_count.cmp(&a.reject_count));
    patterns
}

/// reject_rate のしきい値（この値以上で Warning）
const REJECT_RATE_WARNING_THRESHOLD: f64 = 0.5;
/// reject_rate のしきい値（この値以上で Alert）
const REJECT_RATE_ALERT_THRESHOLD: f64 = 0.7;
/// 統計が有意とみなす最小レビュー数
const MIN_REVIEWS_FOR_SUGGESTION: usize = 3;

/// PRの変更内容と過去のレビューパターンから、注意すべきポイントのリストを返す。
///
/// `files` は対象PRの変更ファイル分析結果、`risk_level` はPRのリスクレベル、
/// `stats` は過去の `analyze_review_patterns()` の結果。
pub fn suggest_review_focus(
    files: &[FileAnalysis],
    risk_level: &RiskLevel,
    stats: &ReviewPatternStats,
) -> Vec<ReviewSuggestion> {
    let mut suggestions = Vec::new();

    // PRに含まれるカテゴリを収集
    let mut pr_categories: Vec<ChangeCategory> = Vec::new();
    for file in files {
        if !pr_categories.contains(&file.category) {
            pr_categories.push(file.category.clone());
        }
    }

    // カテゴリ別のサジェスト
    for category in &pr_categories {
        if let Some(cat_stat) = stats.category_stats.get(category) {
            if cat_stat.total >= MIN_REVIEWS_FOR_SUGGESTION
                && cat_stat.reject_rate >= REJECT_RATE_WARNING_THRESHOLD
            {
                let percent = (cat_stat.reject_rate * 100.0).round() as u32;
                let severity = if cat_stat.reject_rate >= REJECT_RATE_ALERT_THRESHOLD {
                    SuggestionSeverity::Alert
                } else {
                    SuggestionSeverity::Warning
                };
                suggestions.push(ReviewSuggestion {
                    message: format!(
                        "{:?}カテゴリの変更は過去{}%がrequest_changesされています",
                        category, percent
                    ),
                    severity,
                    source: format!("category_stats:{:?}", category),
                });
            }
        }
    }

    // リスクレベル別のサジェスト
    if let Some(risk_stat) = stats.risk_stats.get(risk_level) {
        if risk_stat.total >= MIN_REVIEWS_FOR_SUGGESTION
            && risk_stat.reject_rate >= REJECT_RATE_WARNING_THRESHOLD
        {
            let percent = (risk_stat.reject_rate * 100.0).round() as u32;
            let severity = if risk_stat.reject_rate >= REJECT_RATE_ALERT_THRESHOLD {
                SuggestionSeverity::Alert
            } else {
                SuggestionSeverity::Warning
            };
            suggestions.push(ReviewSuggestion {
                message: format!(
                    "リスクレベル{:?}のPRは過去{}%がrequest_changesされています",
                    risk_level, percent
                ),
                severity,
                source: format!("risk_stats:{:?}", risk_level),
            });
        }
    }

    // reject_path_patterns に基づくサジェスト（Info レベル）
    for reject_pattern in &stats.reject_path_patterns {
        // PR のカテゴリ名と一致するパターンがあればサジェスト
        for category in &pr_categories {
            let category_name = format!("{:?}", category);
            if reject_pattern.pattern == category_name && reject_pattern.reject_count >= 2 {
                suggestions.push(ReviewSuggestion {
                    message: format!(
                        "{}に関連する変更は過去{}回request_changesされています",
                        reject_pattern.pattern, reject_pattern.reject_count
                    ),
                    severity: SuggestionSeverity::Info,
                    source: format!("reject_path_patterns:{}", reject_pattern.pattern),
                });
            }
        }
    }

    suggestions
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_record(
        pr_number: u64,
        action: ReviewEvent,
        risk_level: RiskLevel,
        categories: Vec<ChangeCategory>,
    ) -> ReviewRecord {
        ReviewRecord {
            pr_number,
            repository: "owner/repo".to_string(),
            action,
            risk_level,
            timestamp: "2025-01-15T10:30:00Z".to_string(),
            categories,
        }
    }

    fn make_file_analysis(path: &str, category: ChangeCategory) -> FileAnalysis {
        FileAnalysis {
            path: path.to_string(),
            category,
            additions: 10,
            deletions: 5,
        }
    }

    // =====================
    // analyze_review_patterns のテスト
    // =====================

    #[test]
    fn test_empty_history() {
        let stats = analyze_review_patterns(&[]);
        assert_eq!(stats.total_reviews, 0);
        assert!(stats.category_stats.is_empty());
        assert!(stats.risk_stats.is_empty());
        assert!(stats.reject_path_patterns.is_empty());
    }

    #[test]
    fn test_single_approve() {
        let records = vec![make_record(
            1,
            ReviewEvent::Approve,
            RiskLevel::Low,
            vec![ChangeCategory::Logic],
        )];

        let stats = analyze_review_patterns(&records);

        assert_eq!(stats.total_reviews, 1);

        let logic_stat = stats.category_stats.get(&ChangeCategory::Logic).unwrap();
        assert_eq!(logic_stat.total, 1);
        assert_eq!(logic_stat.approved, 1);
        assert_eq!(logic_stat.rejected, 0);
        assert_eq!(logic_stat.reject_rate, 0.0);

        let low_stat = stats.risk_stats.get(&RiskLevel::Low).unwrap();
        assert_eq!(low_stat.total, 1);
        assert_eq!(low_stat.approved, 1);
        assert_eq!(low_stat.rejected, 0);
    }

    #[test]
    fn test_biased_history_pattern_extraction() {
        // Logic カテゴリが 7/10 reject される偏った履歴
        let mut records = Vec::new();
        for i in 0..7 {
            records.push(make_record(
                i,
                ReviewEvent::RequestChanges,
                RiskLevel::High,
                vec![ChangeCategory::Logic],
            ));
        }
        for i in 7..10 {
            records.push(make_record(
                i,
                ReviewEvent::Approve,
                RiskLevel::High,
                vec![ChangeCategory::Logic],
            ));
        }

        let stats = analyze_review_patterns(&records);

        assert_eq!(stats.total_reviews, 10);

        let logic_stat = stats.category_stats.get(&ChangeCategory::Logic).unwrap();
        assert_eq!(logic_stat.total, 10);
        assert_eq!(logic_stat.rejected, 7);
        assert_eq!(logic_stat.approved, 3);
        assert!((logic_stat.reject_rate - 0.7).abs() < f64::EPSILON);

        let high_stat = stats.risk_stats.get(&RiskLevel::High).unwrap();
        assert_eq!(high_stat.total, 10);
        assert_eq!(high_stat.rejected, 7);
        assert!((high_stat.reject_rate - 0.7).abs() < f64::EPSILON);
    }

    #[test]
    fn test_multiple_categories_per_record() {
        let records = vec![make_record(
            1,
            ReviewEvent::RequestChanges,
            RiskLevel::Medium,
            vec![ChangeCategory::Logic, ChangeCategory::Config],
        )];

        let stats = analyze_review_patterns(&records);

        let logic_stat = stats.category_stats.get(&ChangeCategory::Logic).unwrap();
        assert_eq!(logic_stat.total, 1);
        assert_eq!(logic_stat.rejected, 1);

        let config_stat = stats.category_stats.get(&ChangeCategory::Config).unwrap();
        assert_eq!(config_stat.total, 1);
        assert_eq!(config_stat.rejected, 1);
    }

    #[test]
    fn test_reject_path_patterns_sorted_by_count() {
        let records = vec![
            make_record(
                1,
                ReviewEvent::RequestChanges,
                RiskLevel::High,
                vec![ChangeCategory::Logic],
            ),
            make_record(
                2,
                ReviewEvent::RequestChanges,
                RiskLevel::High,
                vec![ChangeCategory::Logic],
            ),
            make_record(
                3,
                ReviewEvent::RequestChanges,
                RiskLevel::Medium,
                vec![ChangeCategory::Config],
            ),
        ];

        let stats = analyze_review_patterns(&records);

        assert_eq!(stats.reject_path_patterns.len(), 2);
        assert_eq!(stats.reject_path_patterns[0].pattern, "Logic");
        assert_eq!(stats.reject_path_patterns[0].reject_count, 2);
        assert_eq!(stats.reject_path_patterns[1].pattern, "Config");
        assert_eq!(stats.reject_path_patterns[1].reject_count, 1);
    }

    // =====================
    // suggest_review_focus のテスト
    // =====================

    #[test]
    fn test_suggest_empty_stats() {
        let files = vec![make_file_analysis("src/main.rs", ChangeCategory::Logic)];
        let stats = ReviewPatternStats {
            category_stats: HashMap::new(),
            risk_stats: HashMap::new(),
            reject_path_patterns: Vec::new(),
            total_reviews: 0,
        };

        let suggestions = suggest_review_focus(&files, &RiskLevel::Low, &stats);
        assert!(suggestions.is_empty());
    }

    #[test]
    fn test_suggest_high_reject_rate_category() {
        // Logic カテゴリの reject_rate が 70% の履歴を作る
        let mut records = Vec::new();
        for i in 0..7 {
            records.push(make_record(
                i,
                ReviewEvent::RequestChanges,
                RiskLevel::Medium,
                vec![ChangeCategory::Logic],
            ));
        }
        for i in 7..10 {
            records.push(make_record(
                i,
                ReviewEvent::Approve,
                RiskLevel::Medium,
                vec![ChangeCategory::Logic],
            ));
        }

        let stats = analyze_review_patterns(&records);
        let files = vec![make_file_analysis("src/main.rs", ChangeCategory::Logic)];

        let suggestions = suggest_review_focus(&files, &RiskLevel::Low, &stats);

        // カテゴリ Alert + reject_path_patterns Info
        let category_suggestion = suggestions
            .iter()
            .find(|s| s.source.starts_with("category_stats:"))
            .expect("カテゴリに基づくサジェストが必要");
        assert_eq!(category_suggestion.severity, SuggestionSeverity::Alert);
        assert!(category_suggestion.message.contains("70%"));
        assert!(category_suggestion.message.contains("Logic"));
    }

    #[test]
    fn test_suggest_warning_severity_for_50_percent() {
        // reject_rate 50% → Warning
        let mut records = Vec::new();
        for i in 0..5 {
            records.push(make_record(
                i,
                ReviewEvent::RequestChanges,
                RiskLevel::Low,
                vec![ChangeCategory::Config],
            ));
        }
        for i in 5..10 {
            records.push(make_record(
                i,
                ReviewEvent::Approve,
                RiskLevel::Low,
                vec![ChangeCategory::Config],
            ));
        }

        let stats = analyze_review_patterns(&records);
        let files = vec![make_file_analysis("config.toml", ChangeCategory::Config)];

        let suggestions = suggest_review_focus(&files, &RiskLevel::Medium, &stats);

        let category_suggestion = suggestions
            .iter()
            .find(|s| s.source.starts_with("category_stats:"))
            .expect("カテゴリに基づくサジェストが必要");
        assert_eq!(category_suggestion.severity, SuggestionSeverity::Warning);
        assert!(category_suggestion.message.contains("50%"));
    }

    #[test]
    fn test_suggest_risk_level_based() {
        // High リスクの reject_rate が 80%
        let mut records = Vec::new();
        for i in 0..4 {
            records.push(make_record(
                i,
                ReviewEvent::RequestChanges,
                RiskLevel::High,
                vec![ChangeCategory::Documentation],
            ));
        }
        records.push(make_record(
            4,
            ReviewEvent::Approve,
            RiskLevel::High,
            vec![ChangeCategory::Documentation],
        ));

        let stats = analyze_review_patterns(&records);
        let files = vec![make_file_analysis(
            "README.md",
            ChangeCategory::Documentation,
        )];

        let suggestions = suggest_review_focus(&files, &RiskLevel::High, &stats);

        let risk_suggestion = suggestions
            .iter()
            .find(|s| s.source.starts_with("risk_stats:"))
            .expect("リスクレベルに基づくサジェストが必要");
        assert_eq!(risk_suggestion.severity, SuggestionSeverity::Alert);
        assert!(risk_suggestion.message.contains("High"));
        assert!(risk_suggestion.message.contains("80%"));
    }

    #[test]
    fn test_suggest_no_suggestion_below_threshold() {
        // reject_rate 30% → しきい値未満でサジェストなし
        let mut records = Vec::new();
        for i in 0..3 {
            records.push(make_record(
                i,
                ReviewEvent::RequestChanges,
                RiskLevel::Low,
                vec![ChangeCategory::Logic],
            ));
        }
        for i in 3..10 {
            records.push(make_record(
                i,
                ReviewEvent::Approve,
                RiskLevel::Low,
                vec![ChangeCategory::Logic],
            ));
        }

        let stats = analyze_review_patterns(&records);
        let files = vec![make_file_analysis("src/lib.rs", ChangeCategory::Logic)];

        let suggestions = suggest_review_focus(&files, &RiskLevel::Low, &stats);

        // カテゴリ・リスクともに30%なのでWarning以上のサジェストは出ない
        let high_severity = suggestions
            .iter()
            .filter(|s| {
                s.severity == SuggestionSeverity::Warning || s.severity == SuggestionSeverity::Alert
            })
            .count();
        assert_eq!(high_severity, 0);
    }

    #[test]
    fn test_suggest_insufficient_data() {
        // 2件しかない → MIN_REVIEWS_FOR_SUGGESTION 未満でサジェストなし
        let records = vec![
            make_record(
                1,
                ReviewEvent::RequestChanges,
                RiskLevel::Low,
                vec![ChangeCategory::Logic],
            ),
            make_record(
                2,
                ReviewEvent::RequestChanges,
                RiskLevel::Low,
                vec![ChangeCategory::Logic],
            ),
        ];

        let stats = analyze_review_patterns(&records);
        let files = vec![make_file_analysis("src/lib.rs", ChangeCategory::Logic)];

        let suggestions = suggest_review_focus(&files, &RiskLevel::Low, &stats);

        // 2件ではカテゴリ・リスクのWarning/Alertは出ない
        let high_severity = suggestions
            .iter()
            .filter(|s| {
                s.severity == SuggestionSeverity::Warning || s.severity == SuggestionSeverity::Alert
            })
            .count();
        assert_eq!(high_severity, 0);
    }

    #[test]
    fn test_suggest_unrelated_category_ignored() {
        // Config カテゴリが高 reject_rate だが、PR は Logic のみ
        let mut records = Vec::new();
        for i in 0..5 {
            records.push(make_record(
                i,
                ReviewEvent::RequestChanges,
                RiskLevel::Low,
                vec![ChangeCategory::Config],
            ));
        }

        let stats = analyze_review_patterns(&records);
        let files = vec![make_file_analysis("src/main.rs", ChangeCategory::Logic)];

        let suggestions = suggest_review_focus(&files, &RiskLevel::Medium, &stats);

        // Logic カテゴリに関するサジェストは出ない
        let category_suggestions: Vec<_> = suggestions
            .iter()
            .filter(|s| s.source.starts_with("category_stats:"))
            .collect();
        assert!(category_suggestions.is_empty());
    }

    #[test]
    fn test_serialization() {
        let stats = ReviewPatternStats {
            category_stats: {
                let mut m = HashMap::new();
                m.insert(
                    ChangeCategory::Logic,
                    CategoryStat {
                        total: 10,
                        approved: 3,
                        rejected: 7,
                        reject_rate: 0.7,
                    },
                );
                m
            },
            risk_stats: {
                let mut m = HashMap::new();
                m.insert(
                    RiskLevel::High,
                    RiskStat {
                        total: 5,
                        approved: 1,
                        rejected: 4,
                        reject_rate: 0.8,
                    },
                );
                m
            },
            reject_path_patterns: vec![RejectPathPattern {
                pattern: "Logic".to_string(),
                reject_count: 7,
            }],
            total_reviews: 10,
        };

        let json = serde_json::to_value(&stats).unwrap();
        assert_eq!(json["total_reviews"], 10);
        assert!(json["category_stats"].is_object());
        assert!(json["risk_stats"].is_object());
        assert!(json["reject_path_patterns"].is_array());

        let suggestion = ReviewSuggestion {
            message: "テストメッセージ".to_string(),
            severity: SuggestionSeverity::Alert,
            source: "category_stats:Logic".to_string(),
        };

        let json = serde_json::to_value(&suggestion).unwrap();
        assert_eq!(json["severity"], "Alert");
        assert_eq!(json["source"], "category_stats:Logic");
    }

    #[test]
    fn test_deserialization() {
        let json = r#"{
            "category_stats": {
                "Logic": { "total": 5, "approved": 2, "rejected": 3, "reject_rate": 0.6 }
            },
            "risk_stats": {
                "Low": { "total": 3, "approved": 1, "rejected": 2, "reject_rate": 0.667 }
            },
            "reject_path_patterns": [
                { "pattern": "Logic", "reject_count": 3 }
            ],
            "total_reviews": 5
        }"#;

        let stats: ReviewPatternStats = serde_json::from_str(json).unwrap();
        assert_eq!(stats.total_reviews, 5);
        assert!(stats.category_stats.contains_key(&ChangeCategory::Logic));
        assert!(stats.risk_stats.contains_key(&RiskLevel::Low));
    }
}
