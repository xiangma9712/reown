import type { Meta, StoryObj } from "@storybook/react-vite";
import { CommitListPanel } from "./CommitListPanel";
import { fixtures } from "../storybook";

const meta = {
  title: "Components/CommitListPanel",
  component: CommitListPanel,
  args: {
    commits: fixtures.commits,
  },
} satisfies Meta<typeof CommitListPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト（コミット一覧表示） */
export const Default: Story = {};

/** ローディング状態 */
export const Loading: Story = {
  args: {
    commits: [],
    loading: true,
  },
};

/** エラー状態 */
export const Error: Story = {
  args: {
    commits: [],
    error: "GitHub API rate limit exceeded. Please try again later.",
  },
};

/** 空状態（コミットが0件） */
export const Empty: Story = {
  args: {
    commits: [],
  },
};

/** commit_url が空の場合のフォールバック表示 */
export const EmptyCommitUrl: Story = {
  args: {
    commits: [
      {
        sha: "abc1234567890abcdef1234567890abcdef123456",
        message: "feat: commit_url がある場合",
        author: "dev-user",
        date: "2025-01-15T09:00:00Z",
        commit_url: "https://github.com/example/repo/commit/abc123",
      },
      {
        sha: "def4567890abcdef1234567890abcdef456789ab",
        message: "fix: commit_url が空の場合",
        author: "dev-user",
        date: "2025-01-15T10:00:00Z",
        commit_url: "",
      },
    ],
  },
};
