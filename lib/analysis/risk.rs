use crate::git::diff::FileDiff;
use crate::github::PrInfo;

use super::classify::{ChangeCategory, classify_file_change, count_changes, effective_path};

/// リスクレベル
#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

/// リスクスコア（0〜100）
#[derive(Debug, Clone, serde::Serialize)]
pub struct RiskScore {
    /// 総合スコア（0〜100、高いほどリスクが高い）
    pub score: u32,
    /// リスクレベル
    pub level: RiskLevel,
    /// スコアリング要素の内訳
    pub factors: Vec<RiskFactor>,
}

/// スコアリング要素の内訳
#[derive(Debug, Clone, serde::Serialize)]
pub struct RiskFactor {
    /// 要素名
    pub name: String,
    /// この要素によるスコア加算値
    pub score: u32,
    /// 説明
    pub description: String,
}

/// ファイルごとの分析結果
#[derive(Debug, Clone, serde::Serialize)]
pub struct FileAnalysis {
    /// ファイルパス
    pub path: String,
    /// 変更種別
    pub category: ChangeCategory,
    /// 追加行数
    pub additions: usize,
    /// 削除行数
    pub deletions: usize,
}

/// PR全体の分析結果
#[derive(Debug, Clone, serde::Serialize)]
pub struct AnalysisResult {
    /// PR番号
    pub pr_number: u64,
    /// リスクスコア
    pub risk: RiskScore,
    /// ファイルごとの分析
    pub files: Vec<FileAnalysis>,
    /// 変更サマリ
    pub summary: AnalysisSummary,
}

/// 変更のサマリ情報
#[derive(Debug, Clone, serde::Serialize)]
pub struct AnalysisSummary {
    pub total_files: usize,
    pub total_additions: usize,
    pub total_deletions: usize,
    pub has_test_changes: bool,
    pub categories: Vec<CategoryCount>,
}

/// 変更種別ごとのファイル数
#[derive(Debug, Clone, serde::Serialize)]
pub struct CategoryCount {
    pub category: ChangeCategory,
    pub count: usize,
}

/// PrInfo と Vec<FileDiff> からリスク分析を行う
pub fn analyze_pr_risk(pr: &PrInfo, diffs: &[FileDiff]) -> AnalysisResult {
    let file_analyses: Vec<FileAnalysis> = diffs
        .iter()
        .map(|diff| {
            let (additions, deletions) = count_changes(diff);
            FileAnalysis {
                path: effective_path(diff).to_string(),
                category: classify_file_change(diff),
                additions,
                deletions,
            }
        })
        .collect();

    let summary = build_summary(&file_analyses);
    let risk = calculate_risk_score(diffs, &file_analyses, &summary);

    AnalysisResult {
        pr_number: pr.number,
        risk,
        files: file_analyses,
        summary,
    }
}

fn build_summary(files: &[FileAnalysis]) -> AnalysisSummary {
    let total_files = files.len();
    let total_additions: usize = files.iter().map(|f| f.additions).sum();
    let total_deletions: usize = files.iter().map(|f| f.deletions).sum();
    let has_test_changes = files.iter().any(|f| f.category == ChangeCategory::Test);

    // カテゴリごとのカウント
    let mut category_counts: Vec<(ChangeCategory, usize)> = Vec::new();
    for file in files {
        if let Some(entry) = category_counts.iter_mut().find(|(c, _)| *c == file.category) {
            entry.1 += 1;
        } else {
            category_counts.push((file.category.clone(), 1));
        }
    }

    let categories = category_counts
        .into_iter()
        .map(|(category, count)| CategoryCount { category, count })
        .collect();

    AnalysisSummary {
        total_files,
        total_additions,
        total_deletions,
        has_test_changes,
        categories,
    }
}

fn calculate_risk_score(
    diffs: &[FileDiff],
    files: &[FileAnalysis],
    summary: &AnalysisSummary,
) -> RiskScore {
    let mut factors = Vec::new();
    let mut total_score: u32 = 0;

    // 要素1: 変更ファイル数
    let file_count_score = match summary.total_files {
        0..=3 => 0,
        4..=10 => 10,
        11..=20 => 20,
        _ => 30,
    };
    if file_count_score > 0 {
        factors.push(RiskFactor {
            name: "file_count".to_string(),
            score: file_count_score,
            description: format!("{}ファイルが変更されています", summary.total_files),
        });
        total_score += file_count_score;
    }

    // 要素2: 変更行数
    let total_lines = summary.total_additions + summary.total_deletions;
    let line_count_score = match total_lines {
        0..=50 => 0,
        51..=200 => 10,
        201..=500 => 20,
        _ => 30,
    };
    if line_count_score > 0 {
        factors.push(RiskFactor {
            name: "line_count".to_string(),
            score: line_count_score,
            description: format!(
                "合計{}行の変更（+{} / -{}）",
                total_lines, summary.total_additions, summary.total_deletions
            ),
        });
        total_score += line_count_score;
    }

    // 要素3: センシティブなパスパターン
    let sensitive_score = calculate_sensitive_path_score(diffs);
    if sensitive_score > 0 {
        factors.push(RiskFactor {
            name: "sensitive_paths".to_string(),
            score: sensitive_score,
            description: "セキュリティ・DB・API関連のファイルが変更されています".to_string(),
        });
        total_score += sensitive_score;
    }

    // 要素4: テストファイルの有無
    let logic_changes = files
        .iter()
        .any(|f| f.category == ChangeCategory::Logic);
    if logic_changes && !summary.has_test_changes {
        let test_score = 15;
        factors.push(RiskFactor {
            name: "no_tests".to_string(),
            score: test_score,
            description: "ロジック変更がありますが、テストの追加・更新がありません".to_string(),
        });
        total_score += test_score;
    }

    total_score = total_score.min(100);

    let level = match total_score {
        0..=25 => RiskLevel::Low,
        26..=55 => RiskLevel::Medium,
        _ => RiskLevel::High,
    };

    RiskScore {
        score: total_score,
        level,
        factors,
    }
}

/// センシティブなパスパターンによるスコア加算
fn calculate_sensitive_path_score(diffs: &[FileDiff]) -> u32 {
    let mut score = 0u32;

    for diff in diffs {
        let path = effective_path(diff).to_lowercase();

        // 認証・セキュリティ関連
        if path.contains("auth")
            || path.contains("security")
            || path.contains("permission")
            || path.contains("credential")
            || path.contains("token")
            || path.contains("secret")
            || path.contains("encrypt")
            || path.contains("password")
        {
            score = score.max(25);
        }

        // DB・マイグレーション関連
        if path.contains("migration")
            || path.contains("schema")
            || path.contains("database")
            || path.contains("db/")
        {
            score = score.max(20);
        }

        // API 関連
        if path.contains("api/") || path.contains("endpoint") || path.contains("route") {
            score = score.max(15);
        }

        // インフラ・デプロイ関連
        if path.contains("deploy")
            || path.contains("infra")
            || path.contains("terraform")
            || path.contains("docker")
            || path.contains("k8s")
            || path.contains("kubernetes")
        {
            score = score.max(20);
        }
    }

    score
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::diff::{DiffChunk, DiffLineInfo, FileStatus, LineOrigin};

    fn make_pr(number: u64) -> PrInfo {
        PrInfo {
            number,
            title: "Test PR".to_string(),
            author: "tester".to_string(),
            state: "open".to_string(),
            head_branch: "feature".to_string(),
            base_branch: "main".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
            additions: 0,
            deletions: 0,
            changed_files: 0,
            body: String::new(),
            html_url: "https://github.com/owner/repo/pull/1".to_string(),
        }
    }

    fn make_diff(path: &str, additions: usize, deletions: usize) -> FileDiff {
        let mut lines = Vec::new();
        for _ in 0..additions {
            lines.push(DiffLineInfo {
                origin: LineOrigin::Addition,
                old_lineno: None,
                new_lineno: Some(1),
                content: "added\n".to_string(),
            });
        }
        for _ in 0..deletions {
            lines.push(DiffLineInfo {
                origin: LineOrigin::Deletion,
                old_lineno: Some(1),
                new_lineno: None,
                content: "removed\n".to_string(),
            });
        }

        FileDiff {
            old_path: Some(path.to_string()),
            new_path: Some(path.to_string()),
            status: FileStatus::Modified,
            chunks: if lines.is_empty() {
                vec![]
            } else {
                vec![DiffChunk {
                    header: "@@ -1,1 +1,1 @@".to_string(),
                    lines,
                }]
            },
        }
    }

    #[test]
    fn test_low_risk_small_doc_change() {
        let pr = make_pr(1);
        let diffs = vec![make_diff("README.md", 5, 2)];
        let result = analyze_pr_risk(&pr, &diffs);

        assert_eq!(result.risk.level, RiskLevel::Low);
        assert_eq!(result.pr_number, 1);
        assert_eq!(result.files.len(), 1);
        assert_eq!(result.files[0].category, ChangeCategory::Documentation);
    }

    #[test]
    fn test_low_risk_small_source_with_test() {
        let pr = make_pr(2);
        let diffs = vec![
            make_diff("src/lib.rs", 10, 0),
            make_diff("src/tests/lib_test.rs", 15, 0),
        ];
        let result = analyze_pr_risk(&pr, &diffs);

        assert_eq!(result.risk.level, RiskLevel::Low);
        assert!(result.summary.has_test_changes);
    }

    #[test]
    fn test_medium_risk_many_files() {
        let pr = make_pr(3);
        let diffs: Vec<FileDiff> = (0..8)
            .map(|i| make_diff(&format!("src/mod{i}.rs"), 20, 0))
            .collect();
        let result = analyze_pr_risk(&pr, &diffs);

        // 8 files (10pt) + 160 lines (10pt) + no tests (15pt) = 35pt → Medium
        assert_eq!(result.risk.level, RiskLevel::Medium);
    }

    #[test]
    fn test_high_risk_auth_change_many_lines() {
        let pr = make_pr(4);
        let diffs = vec![
            make_diff("src/auth/login.rs", 200, 100),
            make_diff("src/auth/token.rs", 50, 20),
            make_diff("src/api/endpoints.rs", 100, 50),
        ];
        let result = analyze_pr_risk(&pr, &diffs);

        // 3 files (0pt) + 520 lines (30pt) + sensitive auth (25pt) + no tests (15pt) = 70pt → High
        assert_eq!(result.risk.level, RiskLevel::High);
    }

    #[test]
    fn test_empty_diffs() {
        let pr = make_pr(5);
        let diffs: Vec<FileDiff> = vec![];
        let result = analyze_pr_risk(&pr, &diffs);

        assert_eq!(result.risk.level, RiskLevel::Low);
        assert_eq!(result.risk.score, 0);
        assert!(result.files.is_empty());
        assert_eq!(result.summary.total_files, 0);
    }

    #[test]
    fn test_summary_counts() {
        let pr = make_pr(6);
        let diffs = vec![
            make_diff("src/main.rs", 10, 5),
            make_diff("README.md", 3, 1),
            make_diff("src/test_helper.rs", 8, 2),
        ];
        let result = analyze_pr_risk(&pr, &diffs);

        assert_eq!(result.summary.total_files, 3);
        assert_eq!(result.summary.total_additions, 21);
        assert_eq!(result.summary.total_deletions, 8);
        assert!(result.summary.has_test_changes);
    }

    #[test]
    fn test_risk_score_capped_at_100() {
        let pr = make_pr(7);
        // 大量のファイル + 大量の変更行 + センシティブパス + テストなし
        let mut diffs: Vec<FileDiff> = (0..30)
            .map(|i| make_diff(&format!("src/auth/mod{i}.rs"), 100, 50))
            .collect();
        diffs.push(make_diff("src/db/migration.rs", 200, 100));
        let result = analyze_pr_risk(&pr, &diffs);

        assert!(result.risk.score <= 100);
        assert_eq!(result.risk.level, RiskLevel::High);
    }

    #[test]
    fn test_sensitive_path_db_migration() {
        let pr = make_pr(8);
        let diffs = vec![make_diff("db/migration/001_create_users.sql", 30, 0)];
        let result = analyze_pr_risk(&pr, &diffs);

        let has_sensitive_factor = result
            .risk
            .factors
            .iter()
            .any(|f| f.name == "sensitive_paths");
        assert!(has_sensitive_factor);
    }

    #[test]
    fn test_no_test_penalty() {
        let pr = make_pr(9);
        // ロジック変更のみ、テストなし
        let diffs = vec![make_diff("src/main.rs", 20, 0)];
        let result = analyze_pr_risk(&pr, &diffs);

        let has_no_test_factor = result
            .risk
            .factors
            .iter()
            .any(|f| f.name == "no_tests");
        assert!(has_no_test_factor);
    }

    #[test]
    fn test_no_test_penalty_not_applied_for_doc_only() {
        let pr = make_pr(10);
        // ドキュメント変更のみ → テストなしペナルティは不要
        let diffs = vec![make_diff("README.md", 50, 10)];
        let result = analyze_pr_risk(&pr, &diffs);

        let has_no_test_factor = result
            .risk
            .factors
            .iter()
            .any(|f| f.name == "no_tests");
        assert!(!has_no_test_factor);
    }

    #[test]
    fn test_file_analysis_details() {
        let pr = make_pr(11);
        let diffs = vec![make_diff("src/app.rs", 15, 5)];
        let result = analyze_pr_risk(&pr, &diffs);

        assert_eq!(result.files[0].path, "src/app.rs");
        assert_eq!(result.files[0].additions, 15);
        assert_eq!(result.files[0].deletions, 5);
        assert_eq!(result.files[0].category, ChangeCategory::Logic);
    }
}
