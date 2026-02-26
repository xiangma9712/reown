export interface WorktreeInfo {
  name: string;
  path: string;
  branch: string | null;
  is_main: boolean;
  is_locked: boolean;
}

export interface BranchInfo {
  name: string;
  is_head: boolean;
  upstream: string | null;
}

export interface EnrichedBranchInfo {
  name: string;
  is_head: boolean;
  upstream: string | null;
  is_local: boolean;
  is_remote: boolean;
  has_worktree: boolean;
  worktree_path: string | null;
  pr_number: number | null;
  pr_title: string | null;
}

export interface DiffLineInfo {
  origin: "Addition" | "Deletion" | "Context" | { Other: string };
  old_lineno: number | null;
  new_lineno: number | null;
  content: string;
}

export interface DiffChunk {
  header: string;
  lines: DiffLineInfo[];
}

export interface FileDiff {
  old_path: string | null;
  new_path: string | null;
  status: "Added" | "Deleted" | "Modified" | "Renamed" | "Other";
  chunks: DiffChunk[];
}

export interface CategorizedFileDiff extends FileDiff {
  category: ChangeCategory;
}

export interface PrInfo {
  number: number;
  title: string;
  author: string;
  state: string;
  head_branch: string;
  base_branch: string;
  updated_at: string;
  additions: number;
  deletions: number;
  changed_files: number;
  body: string;
  html_url: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  commit_url: string;
}

export interface RepositoryEntry {
  name: string;
  path: string;
}

export interface RepoInfo {
  path: string;
  name: string;
  remote_url: string | null;
  github_owner: string | null;
  github_repo: string | null;
}

export interface LlmConfig {
  llm_endpoint: string;
  llm_model: string;
  llm_api_key_stored: boolean;
}

export type AutoApproveMaxRisk = "Low" | "Medium";

export type ConfigMergeMethod = "Merge" | "Squash" | "Rebase";

export interface AutomationConfig {
  enabled: boolean;
  auto_approve_max_risk: AutoApproveMaxRisk;
  enable_auto_merge: boolean;
  auto_merge_method: ConfigMergeMethod;
}

export interface AppConfig {
  github_token: string;
  default_owner: string;
  default_repo: string;
  llm: LlmConfig;
  automation: AutomationConfig;
}

export interface FileSummary {
  path: string;
  summary: string;
}

export interface PrSummary {
  overall_summary: string;
  reason: string;
  file_summaries: FileSummary[];
}

export interface ConsistencyResult {
  is_consistent: boolean;
  warnings: string[];
}

// ── TODO Types ──────────────────────────────────────────────────────────────

export type TodoKind = "Todo" | "Fixme";

export interface TodoItem {
  file_path: string;
  line_number: number;
  kind: TodoKind;
  content: string;
}

// ── Review Types ────────────────────────────────────────────────────────────

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES";

export interface ReviewRecord {
  pr_number: number;
  repository: string;
  action: ReviewEvent;
  risk_level: RiskLevel;
  timestamp: string;
  categories: ChangeCategory[];
}

// ── Risk Analysis Types ─────────────────────────────────────────────────────

export type RiskLevel = "Low" | "Medium" | "High";

export type ChangeCategory =
  | "Logic"
  | "Refactor"
  | "Test"
  | "Config"
  | "Documentation"
  | "CI"
  | "Dependency"
  | "Other";

export interface RiskFactor {
  name: string;
  score: number;
  description: string;
}

export interface RiskScore {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
}

export interface FileAnalysis {
  path: string;
  category: ChangeCategory;
  additions: number;
  deletions: number;
}

export interface CategoryCount {
  category: ChangeCategory;
  count: number;
}

export interface AnalysisSummary {
  total_files: number;
  total_additions: number;
  total_deletions: number;
  has_test_changes: boolean;
  categories: CategoryCount[];
}

export interface AnalysisResult {
  pr_number: number;
  risk: RiskScore;
  files: FileAnalysis[];
  summary: AnalysisSummary;
}

export interface AffectedModule {
  name: string;
  description: string;
}

export type BreakingChangeSeverity = "Warning" | "Critical";

export interface BreakingChange {
  file_path: string;
  description: string;
  severity: BreakingChangeSeverity;
}

export interface LlmAnalysisResult {
  affected_modules: AffectedModule[];
  breaking_changes: BreakingChange[];
  risk_warnings: string[];
  llm_risk_level: RiskLevel;
  summary: string;
}

export interface HybridAnalysisResult {
  static_analysis: AnalysisResult;
  llm_analysis: LlmAnalysisResult;
  combined_risk_level: RiskLevel;
}

// ── Auto-Approve / Merge Types ───────────────────────────────────────────────

export interface AutoApproveCandidate {
  pr_number: number;
  risk_level: RiskLevel;
  reason: string;
}

export type AutoMergeStatus =
  | "Enabled"
  | "Skipped"
  | "SkippedDueToApproveFail"
  | { Failed: string };

export interface ApproveWithMergeOutcome {
  pr_number: number;
  approve_success: boolean;
  approve_error: string | null;
  auto_merge_status: AutoMergeStatus;
}

export interface AutoApproveWithMergeResult {
  outcomes: ApproveWithMergeOutcome[];
  merge_method: ConfigMergeMethod;
}

// ── Review Pattern Types ────────────────────────────────────────────────────

export interface CategoryStat {
  total: number;
  approved: number;
  rejected: number;
  reject_rate: number;
}

export interface RiskStat {
  total: number;
  approved: number;
  rejected: number;
  reject_rate: number;
}

export interface RejectPathPattern {
  pattern: string;
  reject_count: number;
}

export interface ReviewPatternStats {
  category_stats: Record<ChangeCategory, CategoryStat>;
  risk_stats: Record<RiskLevel, RiskStat>;
  reject_path_patterns: RejectPathPattern[];
  total_reviews: number;
}

export type SuggestionSeverity = "Info" | "Warning" | "Alert";

export interface ReviewSuggestion {
  message: string;
  severity: SuggestionSeverity;
  source: string;
}
