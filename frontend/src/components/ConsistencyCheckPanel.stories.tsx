import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within, waitFor } from "storybook/test";
import { ConsistencyCheckPanel } from "./ConsistencyCheckPanel";
import { overrideInvoke, resetInvokeOverrides } from "../storybook";

const meta = {
  title: "Components/ConsistencyCheckPanel",
  component: ConsistencyCheckPanel,
  args: {
    owner: "example",
    repo: "reown",
    prNumber: 42,
  },
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      return <Story />;
    },
  ],
} satisfies Meta<typeof ConsistencyCheckPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 初期状態（Run Checkボタン表示） */
export const Initial: Story = {};

/** ローディング状態（Spinner表示） */
export const Loading: Story = {
  play: async ({ canvasElement }) => {
    overrideInvoke({
      check_pr_consistency: () =>
        new Promise(() => {
          /* never resolves — keep loading */
        }),
    });
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    await userEvent.click(button);
  },
};

/** 成功状態 - 整合性OK（緑バナー） */
export const Consistent: Story = {
  play: async ({ canvasElement }) => {
    overrideInvoke({
      check_pr_consistency: () => ({
        is_consistent: true,
        warnings: [],
      }),
    });
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    await userEvent.click(button);
    await waitFor(() => {
      canvas.getByText("PRタイトル・本文と変更内容は一致しています");
    });
  },
};

/** 成功状態 - 警告あり（黄バナー + 警告リスト） */
export const WithWarnings: Story = {
  play: async ({ canvasElement }) => {
    overrideInvoke({
      check_pr_consistency: () => ({
        is_consistent: false,
        warnings: [
          "PRタイトルに記載された機能が変更内容に含まれていません",
          "テストファイルの変更がありますが、PR本文に記載がありません",
        ],
      }),
    });
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    await userEvent.click(button);
    await waitFor(() => {
      canvas.getByText("PRタイトル・本文と実際の変更内容に乖離があります");
    });
  },
};

/** エラー状態 */
export const Error: Story = {
  play: async ({ canvasElement }) => {
    overrideInvoke({
      check_pr_consistency: () => Promise.reject("API rate limit exceeded"),
    });
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    await userEvent.click(button);
    await waitFor(() => {
      canvas.getByText(/API rate limit exceeded/);
    });
  },
};
