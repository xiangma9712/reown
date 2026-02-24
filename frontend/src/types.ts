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
