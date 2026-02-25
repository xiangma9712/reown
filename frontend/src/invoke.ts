import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type {
  WorktreeInfo,
  BranchInfo,
  EnrichedBranchInfo,
  FileDiff,
  CategorizedFileDiff,
  PrInfo,
  CommitInfo,
  RepositoryEntry,
  AppConfig,
  LlmConfig,
  AutomationConfig,
  RepoInfo,
  PrSummary,
  ConsistencyResult,
  AnalysisResult,
  HybridAnalysisResult,
  ReviewEvent,
  TodoItem,
  ReviewSuggestion,
  AutoApproveCandidate,
  AutoApproveWithMergeResult,
} from "./types";

export type Commands = {
  list_worktrees: { args: { repoPath: string }; ret: WorktreeInfo[] };
  add_worktree: {
    args: { repoPath: string; worktreePath: string; branch: string };
    ret: void;
  };
  list_branches: { args: { repoPath: string }; ret: BranchInfo[] };
  list_enriched_branches: {
    args: { repoPath: string; pullRequests: PrInfo[] };
    ret: EnrichedBranchInfo[];
  };
  create_branch: { args: { repoPath: string; name: string }; ret: void };
  switch_branch: { args: { repoPath: string; name: string }; ret: void };
  delete_branch: { args: { repoPath: string; name: string }; ret: void };
  diff_workdir: { args: { repoPath: string }; ret: FileDiff[] };
  diff_commit: {
    args: { repoPath: string; commitSha: string };
    ret: FileDiff[];
  };
  diff_branches: {
    args: { repoPath: string; baseRef: string; headRef: string };
    ret: FileDiff[];
  };
  list_pull_requests: {
    args: { owner: string; repo: string; token: string };
    ret: PrInfo[];
  };
  get_pull_request_files: {
    args: { owner: string; repo: string; prNumber: number; token: string };
    ret: CategorizedFileDiff[];
  };
  list_pr_commits: {
    args: { owner: string; repo: string; prNumber: number; token: string };
    ret: CommitInfo[];
  };
  submit_pr_review: {
    args: {
      owner: string;
      repo: string;
      prNumber: number;
      event: ReviewEvent;
      body: string;
      token: string;
    };
    ret: void;
  };
  get_repo_info: {
    args: { repoPath: string };
    ret: RepoInfo;
  };
  add_repository: {
    args: { path: string };
    ret: RepositoryEntry;
  };
  list_repositories: { args?: Record<string, unknown>; ret: RepositoryEntry[] };
  remove_repository: {
    args: { path: string };
    ret: void;
  };
  save_app_config: {
    args: { config: AppConfig };
    ret: void;
  };
  load_app_config: { args?: Record<string, unknown>; ret: AppConfig };
  summarize_pull_request: {
    args: { owner: string; repo: string; prNumber: number; token: string };
    ret: PrSummary;
  };
  check_pr_consistency: {
    args: { owner: string; repo: string; prNumber: number; token: string };
    ret: ConsistencyResult;
  };
  save_llm_config: {
    args: { llmConfig: LlmConfig };
    ret: void;
  };
  load_llm_config: { args?: Record<string, unknown>; ret: LlmConfig };
  save_llm_api_key: {
    args: { apiKey: string };
    ret: void;
  };
  delete_llm_api_key: { args?: Record<string, unknown>; ret: void };
  test_llm_connection: {
    args: { endpoint: string; model: string; apiKey?: string };
    ret: void;
  };
  analyze_pr_risk: {
    args: { owner: string; repo: string; prNumber: number; token: string };
    ret: AnalysisResult;
  };
  analyze_pr_risk_with_llm: {
    args: { owner: string; repo: string; prNumber: number; token: string };
    ret: HybridAnalysisResult;
  };
  save_automation_config: {
    args: { automationConfig: AutomationConfig };
    ret: void;
  };
  load_automation_config: {
    args?: Record<string, unknown>;
    ret: AutomationConfig;
  };
  evaluate_auto_approve_candidates: {
    args: { owner: string; repo: string; token: string };
    ret: AutoApproveCandidate[];
  };
  run_auto_approve_with_merge: {
    args: {
      owner: string;
      repo: string;
      token: string;
      candidates: AutoApproveCandidate[];
      automationConfig: AutomationConfig;
    };
    ret: AutoApproveWithMergeResult;
  };
  extract_todos: { args: { repoPath: string }; ret: TodoItem[] };
  suggest_review_comments: {
    args: { owner: string; repo: string; prNumber: number; token: string };
    ret: ReviewSuggestion[];
  };
};

export async function invoke<C extends keyof Commands>(
  command: C,
  ...rest: Commands[C]["args"] extends Record<string, unknown> | undefined
    ? [args?: Commands[C]["args"]]
    : [args: Commands[C]["args"]]
): Promise<Commands[C]["ret"]> {
  return tauriInvoke(command, rest[0] ?? {});
}
