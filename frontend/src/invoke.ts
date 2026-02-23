import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { WorktreeInfo, BranchInfo, FileDiff, PrInfo } from "./types";

type Commands = {
  list_worktrees: { args?: Record<string, unknown>; ret: WorktreeInfo[] };
  add_worktree: {
    args: { worktreePath: string; branch: string };
    ret: void;
  };
  list_branches: { args?: Record<string, unknown>; ret: BranchInfo[] };
  create_branch: { args: { name: string }; ret: void };
  switch_branch: { args: { name: string }; ret: void };
  delete_branch: { args: { name: string }; ret: void };
  diff_workdir: { args?: Record<string, unknown>; ret: FileDiff[] };
  diff_commit: { args: { commitSha: string }; ret: FileDiff[] };
  list_pull_requests: {
    args: { owner: string; repo: string; token: string };
    ret: PrInfo[];
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
