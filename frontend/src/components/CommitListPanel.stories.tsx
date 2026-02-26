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
