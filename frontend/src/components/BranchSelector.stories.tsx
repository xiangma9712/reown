import type { Meta, StoryObj } from "@storybook/react-vite";
import { BranchSelector } from "./BranchSelector";
import {
  overrideInvoke,
  resetInvokeOverrides,
  MockRepositoryProvider,
} from "../storybook";
import fixtures from "../storybook/fixtures";

const meta = {
  title: "Components/BranchSelector",
  component: BranchSelector,
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      return (
        <MockRepositoryProvider>
          <div className="p-4">
            <Story />
          </div>
        </MockRepositoryProvider>
      );
    },
  ],
} satisfies Meta<typeof BranchSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    prs: fixtures.pullRequests,
    selectedBranch: "feature/auth",
    onSelectBranch: () => {},
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        list_enriched_branches: () => [
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
            name: "feature/auth",
            is_head: true,
            upstream: "origin/feature/auth",
            is_local: true,
            is_remote: true,
            has_worktree: false,
            worktree_path: null,
            pr_number: 42,
            pr_title: "認証機能の追加",
            commit_timestamp: 3000,
            is_merged: false,
            is_remote_deleted: false,
          },
          {
            name: "feature/old-merged",
            is_head: false,
            upstream: "origin/feature/old-merged",
            is_local: true,
            is_remote: true,
            has_worktree: false,
            worktree_path: null,
            pr_number: null,
            pr_title: null,
            commit_timestamp: 2000,
            is_merged: true,
            is_remote_deleted: false,
          },
          {
            name: "feature/remote-deleted",
            is_head: false,
            upstream: "origin/feature/remote-deleted",
            is_local: true,
            is_remote: false,
            has_worktree: false,
            worktree_path: null,
            pr_number: null,
            pr_title: null,
            commit_timestamp: 2500,
            is_merged: false,
            is_remote_deleted: true,
          },
        ],
      });
      return <Story />;
    },
  ],
};
