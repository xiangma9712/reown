import type { Meta, StoryObj } from "@storybook/react-vite";
import { WorktreeList } from "./WorktreeList";
import {
  overrideInvoke,
  resetInvokeOverrides,
  MockRepositoryProvider,
  fixtures,
} from "../storybook";

const meta = {
  title: "Components/WorktreeList",
  component: WorktreeList,
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      return (
        <MockRepositoryProvider>
          <Story />
        </MockRepositoryProvider>
      );
    },
  ],
} satisfies Meta<typeof WorktreeList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ワークツリー一覧表示（メイン＋サブ） */
export const WithWorktrees: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        list_worktrees: () => fixtures.worktrees,
      });
      return <Story />;
    },
  ],
};

/** ワークツリーが空の状態 */
export const Empty: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        list_worktrees: () => [],
      });
      return <Story />;
    },
  ],
};

/** ローディング状態 */
export const Loading: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        list_worktrees: () => new Promise(() => {}),
      });
      return <Story />;
    },
  ],
};

/** エラー状態 */
export const Error: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        list_worktrees: () => Promise.reject("Repository not found"),
      });
      return <Story />;
    },
  ],
};

/** メインワークツリーのみ */
export const MainOnly: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        list_worktrees: () => [fixtures.worktrees[0]],
      });
      return <Story />;
    },
  ],
};
