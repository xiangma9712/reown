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

export interface AppConfig {
  github_token: string;
  default_owner: string;
  default_repo: string;
  llm: LlmConfig;
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
