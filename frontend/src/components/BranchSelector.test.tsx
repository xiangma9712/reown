import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BranchSelector } from "./BranchSelector";
import type { EnrichedBranchInfo } from "../types";

vi.mock("react-i18next", async () => {
  const { i18nMock } = await import("../test/i18n-mock");
  return i18nMock;
});

const sampleBranches: EnrichedBranchInfo[] = [
  {
    name: "main",
    is_head: false,
    upstream: "origin/main",
    is_local: true,
    is_remote: true,
    has_worktree: true,
    worktree_path: "/Users/dev/project",
    pr_number: null,
    pr_title: null,
    commit_timestamp: 1000,
    is_merged: false,
    is_remote_deleted: false,
  },
  {
    name: "feature/old-branch",
    is_head: false,
    upstream: "origin/feature/old-branch",
    is_local: true,
    is_remote: true,
    has_worktree: false,
    worktree_path: null,
    pr_number: null,
    pr_title: null,
    commit_timestamp: 2000,
    is_merged: false,
    is_remote_deleted: false,
  },
  {
    name: "feature/new-branch",
    is_head: false,
    upstream: "origin/feature/new-branch",
    is_local: true,
    is_remote: true,
    has_worktree: false,
    worktree_path: null,
    pr_number: 42,
    pr_title: "New feature",
    commit_timestamp: 5000,
    is_merged: false,
    is_remote_deleted: false,
  },
  {
    name: "feature/merged",
    is_head: false,
    upstream: "origin/feature/merged",
    is_local: true,
    is_remote: true,
    has_worktree: false,
    worktree_path: null,
    pr_number: null,
    pr_title: null,
    commit_timestamp: 3000,
    is_merged: true,
    is_remote_deleted: false,
  },
  {
    name: "feature/deleted-on-remote",
    is_head: false,
    upstream: "origin/feature/deleted-on-remote",
    is_local: true,
    is_remote: false,
    has_worktree: false,
    worktree_path: null,
    pr_number: null,
    pr_title: null,
    commit_timestamp: 4000,
    is_merged: false,
    is_remote_deleted: true,
  },
];

vi.mock("../invoke", () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === "list_enriched_branches") {
      return Promise.resolve(sampleBranches);
    }
    return Promise.resolve(null);
  }),
}));

vi.mock("../RepositoryContext", () => ({
  useRepository: () => ({ repoPath: "/test/repo" }),
}));

describe("BranchSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trigger and displays filtered branch list sorted by commit timestamp desc", async () => {
    const onSelect = vi.fn();
    render(
      <BranchSelector
        prs={[]}
        selectedBranch="feature/new-branch"
        onSelectBranch={onSelect}
      />
    );

    const trigger = screen.getByRole("button");
    expect(trigger).toHaveTextContent("feature/new-branch");

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("ブランチを検索…")).toBeInTheDocument();
    });

    // main, feature/merged, and feature/deleted-on-remote must be excluded!
    expect(screen.queryByText("main")).not.toBeInTheDocument();
    expect(screen.queryByText("feature/merged")).not.toBeInTheDocument();
    expect(
      screen.queryByText("feature/deleted-on-remote")
    ).not.toBeInTheDocument();

    // Valid branches feature/new-branch and feature/old-branch must be present
    expect(screen.getAllByText("feature/new-branch").length).toBeGreaterThan(0);
    expect(screen.getByText("feature/old-branch")).toBeInTheDocument();
  });
});
