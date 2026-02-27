/**
 * Storybook用 Tauri invoke モック。
 *
 * 各コマンドに対するデフォルトレスポンスを定義し、
 * ストーリーごとにオーバーライド可能。
 */
import type { Commands } from "../invoke";
import { fixtures } from "./fixtures";

type CommandHandlers = {
  [C in keyof Commands]: (
    args: Commands[C]["args"]
  ) => Commands[C]["ret"] | Promise<Commands[C]["ret"]>;
};

const defaultHandlers: CommandHandlers = {
  list_worktrees: () => fixtures.worktrees,
  add_worktree: () => undefined as never,
  list_branches: () => fixtures.branches,
  list_enriched_branches: () => fixtures.enrichedBranches,
  create_branch: () => undefined as never,
  switch_branch: () => undefined as never,
  delete_branch: () => undefined as never,
  diff_workdir: () => fixtures.fileDiffs,
  diff_commit: () => fixtures.fileDiffs,
  diff_branches: () => fixtures.fileDiffs,
  list_pull_requests: () => fixtures.pullRequests,
  get_pull_request_files: () => fixtures.categorizedFileDiffs,
  list_pr_commits: () => fixtures.commits,
  submit_pr_review: () => undefined as never,
  get_repo_info: () => fixtures.repoInfo,
  add_repository: () => fixtures.repositories[0],
  list_repositories: () => fixtures.repositories,
  remove_repository: () => undefined as never,
  save_app_config: () => undefined as never,
  load_app_config: () => fixtures.appConfig,
  summarize_pull_request: () => fixtures.prSummary,
  check_pr_consistency: () => fixtures.consistencyResult,
  save_llm_config: () => undefined as never,
  load_llm_config: () => fixtures.llmConfig,
  save_llm_api_key: () => undefined as never,
  delete_llm_api_key: () => undefined as never,
  test_llm_connection: () => undefined as never,
  analyze_pr_risk: () => fixtures.analysisResult,
  analyze_pr_risk_with_llm: () => fixtures.hybridAnalysisResult,
  save_automation_config: () => undefined as never,
  load_automation_config: () => fixtures.automationConfig,
  extract_todos: () => fixtures.todoItems,
  create_worktree_for_todo: () => fixtures.worktrees[1],
  suggest_review_comments: () => fixtures.reviewSuggestions,
  evaluate_auto_approve_candidates: () => [],
  run_auto_approve_with_merge: () => fixtures.autoApproveWithMergeResult,
  load_risk_config: () => fixtures.automationConfig.risk_config,
  save_risk_config: () => undefined as never,
  list_review_history: () => fixtures.reviewRecords,
  add_review_record: () => undefined as never,
};

let currentOverrides: Partial<CommandHandlers> = {};

/**
 * ストーリー単位でモックレスポンスをオーバーライドする。
 *
 * @example
 * ```ts
 * overrideInvoke({
 *   list_branches: () => [{ name: "feature", is_head: false, upstream: null }],
 * });
 * ```
 */
export function overrideInvoke(overrides: Partial<CommandHandlers>): void {
  currentOverrides = { ...overrides };
}

/**
 * オーバーライドをリセットしてデフォルトに戻す。
 */
export function resetInvokeOverrides(): void {
  currentOverrides = {};
}

/**
 * Storybook用のinvokeモック実装。
 * `@tauri-apps/api/core` の `invoke` と同じシグネチャ。
 */
export async function mockTauriInvoke(
  command: string,
  args?: Record<string, unknown>
): Promise<unknown> {
  const cmd = command as keyof Commands;
  const handler = currentOverrides[cmd] ?? defaultHandlers[cmd];

  if (!handler) {
    console.warn(`[tauri-invoke-mock] Unhandled command: ${command}`, args);
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handler(args as any);
}
