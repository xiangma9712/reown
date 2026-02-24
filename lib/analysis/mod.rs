mod classify;
pub mod llm_analysis;
pub mod review_pattern;
mod risk;

pub use classify::{CategorizedFileDiff, ChangeCategory, categorize_diffs, classify_file_change};
pub use llm_analysis::{
    AffectedModule, BreakingChange, BreakingChangeSeverity, HybridAnalysisResult,
    LlmAnalysisResult, analyze_pr_with_llm, merge_analysis,
};
pub use review_pattern::{
    CategoryStat, RejectPathPattern, ReviewPatternStats, ReviewSuggestion, RiskStat,
    SuggestionSeverity, analyze_review_patterns, suggest_review_focus,
};
pub use risk::{AnalysisResult, AnalysisSummary, FileAnalysis, RiskLevel, RiskScore, analyze_pr_risk};
