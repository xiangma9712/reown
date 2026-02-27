import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within, waitFor } from "storybook/test";
import { PrSummaryPanel } from "./PrSummaryPanel";
import {
  overrideInvoke,
  resetInvokeOverrides,
  emitMockEvent,
  clearMockListeners,
  fixtures,
} from "../storybook";

const meta = {
  title: "Components/PrSummaryPanel",
  component: PrSummaryPanel,
  args: {
    owner: "example",
    repo: "reown",
    prNumber: 42,
    token: "ghp_dummy",
  },
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      clearMockListeners();
      return <Story />;
    },
  ],
} satisfies Meta<typeof PrSummaryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 初期状態（生成ボタン表示） */
export const Initial: Story = {};

/** ローディング状態（Spinner + ストリーミングテキスト表示） */
export const Loading: Story = {
  play: async ({ canvasElement, args }) => {
    overrideInvoke({
      summarize_pull_request: () =>
        new Promise(() => {
          /* never resolves — keep loading */
        }),
    });
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "AI要約を生成" });
    await userEvent.click(button);
    // ストリーミングテキストをシミュレート
    await new Promise((r) => setTimeout(r, 100));
    emitMockEvent(`summary-stream-${args.prNumber}`, "認証機能を追加する");
    await new Promise((r) => setTimeout(r, 50));
    emitMockEvent(`summary-stream-${args.prNumber}`, "PRです。");
    await waitFor(() => {
      canvas.getByText(/認証機能を追加する/);
    });
  },
};

/** サマリー表示状態（overall_summary + reason + file_summaries） */
export const WithSummary: Story = {
  play: async ({ canvasElement }) => {
    overrideInvoke({
      summarize_pull_request: () => fixtures.prSummary,
    });
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "AI要約を生成" });
    await userEvent.click(button);
    await waitFor(() => {
      canvas.getByText("全体要約");
    });
  },
};

/** エラー状態 */
export const Error: Story = {
  play: async ({ canvasElement }) => {
    overrideInvoke({
      summarize_pull_request: () => Promise.reject("LLM API connection failed"),
    });
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "AI要約を生成" });
    await userEvent.click(button);
    await waitFor(() => {
      canvas.getByText(/LLM API connection failed/);
    });
  },
};
