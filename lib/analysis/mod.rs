mod classify;
pub mod llm_analysis;
pub mod review_pattern;
mod risk;

pub use classify::{categorize_diffs, classify_file_change, CategorizedFileDiff, ChangeCategory};
pub use llm_analysis::{
    analyze_pr_with_llm, merge_analysis, AffectedModule, BreakingChange, BreakingChangeSeverity,
    HybridAnalysisResult, LlmAnalysisResult,
};
pub use review_pattern::{
    analyze_review_patterns, suggest_review_focus, CategoryStat, RejectPathPattern,
    ReviewPatternStats, ReviewSuggestion, RiskStat, SuggestionSeverity,
};
pub use risk::{
    analyze_pr_risk, analyze_pr_risk_with_config, AnalysisResult, AnalysisSummary, CategoryCount,
    FileAnalysis, RiskFactor, RiskLevel, RiskScore,
};
