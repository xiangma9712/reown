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
  RiskConfig,
  RepoInfo,
  PrSummary,
  ConsistencyResult,
  AnalysisResult,
  HybridAnalysisResult,
  ReviewEvent,
  ReviewRecord,
  TodoItem,
  ReviewSuggestion,
  AutoApproveCandidate,
  AutoApproveWithMergeResult,
  DeviceFlowResponse,
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
    args: { owner: string; repo: string };
    ret: PrInfo[];
  };
  get_pull_request_files: {
    args: { owner: string; repo: string; prNumber: number };
    ret: CategorizedFileDiff[];
  };
  list_pr_commits: {
    args: { owner: string; repo: string; prNumber: number };
    ret: CommitInfo[];
  };
  submit_pr_review: {
    args: {
      owner: string;
      repo: string;
      prNumber: number;
      event: ReviewEvent;
      body: string;
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
    args: { owner: string; repo: string; prNumber: number };
    ret: PrSummary;
  };
  check_pr_consistency: {
    args: { owner: string; repo: string; prNumber: number };
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
    args: { owner: string; repo: string; prNumber: number };
    ret: AnalysisResult;
  };
  analyze_pr_risk_with_llm: {
    args: { owner: string; repo: string; prNumber: number };
    ret: HybridAnalysisResult;
  };
  save_automation_config: {
    args: {
      automationConfig: AutomationConfig;
      owner?: string;
      repo?: string;
    };
    ret: void;
  };
  load_automation_config: {
    args?: { owner?: string; repo?: string };
    ret: AutomationConfig;
  };
  load_risk_config: {
    args?: { owner?: string; repo?: string };
    ret: RiskConfig;
  };
  save_risk_config: {
    args: {
      riskConfig: RiskConfig;
      owner?: string;
      repo?: string;
    };
    ret: void;
  };
  load_default_risk_config: { args?: Record<string, unknown>; ret: RiskConfig };
  evaluate_auto_approve_candidates: {
    args: { owner: string; repo: string };
    ret: AutoApproveCandidate[];
  };
  run_auto_approve_with_merge: {
    args: {
      owner: string;
      repo: string;
      candidates: AutoApproveCandidate[];
      automationConfig: AutomationConfig;
    };
    ret: AutoApproveWithMergeResult;
  };
  extract_todos: { args: { repoPath: string }; ret: TodoItem[] };
  create_worktree_for_todo: {
    args: { repoPath: string; filePath: string; lineNumber: number };
    ret: WorktreeInfo;
  };
  suggest_review_comments: {
    args: { owner: string; repo: string; prNumber: number };
    ret: ReviewSuggestion[];
  };
  list_review_history: { args?: Record<string, unknown>; ret: ReviewRecord[] };
  add_review_record: {
    args: { record: ReviewRecord };
    ret: void;
  };
  save_github_token: { args: { token: string }; ret: void };
  get_github_auth_status: { args?: Record<string, unknown>; ret: boolean };
  github_logout: { args?: Record<string, unknown>; ret: void };
  start_github_device_flow: {
    args?: Record<string, unknown>;
    ret: DeviceFlowResponse;
  };
  poll_github_device_flow: {
    args: { deviceCode: string; interval: number };
    ret: void;
  };
  check_onboarding_needed: { args?: Record<string, unknown>; ret: boolean };
  complete_onboarding: { args?: Record<string, unknown>; ret: void };
};

export async function invoke<C extends keyof Commands>(
  command: C,
  ...rest: Commands[C]["args"] extends Record<string, unknown> | undefined
    ? [args?: Commands[C]["args"]]
    : [args: Commands[C]["args"]]
): Promise<Commands[C]["ret"]> {
  return tauriInvoke(command, rest[0] ?? {});
}
