mod classify;
pub mod llm_analysis;
mod risk;

pub use classify::{CategorizedFileDiff, ChangeCategory, categorize_diffs, classify_file_change};
pub use llm_analysis::{
    AffectedModule, BreakingChange, BreakingChangeSeverity, HybridAnalysisResult,
    LlmAnalysisResult, analyze_pr_with_llm, merge_analysis,
};
pub use risk::{AnalysisResult, AnalysisSummary, FileAnalysis, RiskLevel, RiskScore, analyze_pr_risk};
