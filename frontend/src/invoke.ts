import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { WorktreeInfo, BranchInfo, FileDiff, PrInfo, RepositoryEntry, AppConfig } from "./types";

type Commands = {
  list_worktrees: { args: { repoPath: string }; ret: WorktreeInfo[] };
  add_worktree: {
    args: { repoPath: string; worktreePath: string; branch: string };
    ret: void;
  };
  list_branches: { args: { repoPath: string }; ret: BranchInfo[] };
  create_branch: { args: { repoPath: string; name: string }; ret: void };
  switch_branch: { args: { repoPath: string; name: string }; ret: void };
  delete_branch: { args: { repoPath: string; name: string }; ret: void };
  diff_workdir: { args: { repoPath: string }; ret: FileDiff[] };
  diff_commit: { args: { repoPath: string; commitSha: string }; ret: FileDiff[] };
  list_pull_requests: {
    args: { owner: string; repo: string; token: string };
    ret: PrInfo[];
  };
  get_pull_request_files: {
    args: { owner: string; repo: string; prNumber: number; token: string };
    ret: FileDiff[];
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
};

export async function invoke<C extends keyof Commands>(
  command: C,
  ...rest: Commands[C]["args"] extends Record<string, unknown> | undefined
    ? [args?: Commands[C]["args"]]
    : [args: Commands[C]["args"]]
): Promise<Commands[C]["ret"]> {
  return tauriInvoke(command, rest[0] ?? {});
}
