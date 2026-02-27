import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ReviewSuggestionPanel } from "./ReviewSuggestionPanel";
import { overrideInvoke, resetInvokeOverrides, fixtures } from "../storybook";

const meta = {
  title: "Components/ReviewSuggestionPanel",
  component: ReviewSuggestionPanel,
  args: {
    owner: "example",
    repo: "reown",
    prNumber: 42,
    token: "ghp_dummy",
  },
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      return <Story />;
    },
  ],
} satisfies Meta<typeof ReviewSuggestionPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト（アイドル状態） */
export const Default: Story = {};

/** ローディング状態 */
export const Loading: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        suggest_review_comments: () =>
          new Promise(() => {
            /* never resolves */
          }),
      });
      return <Story />;
    },
  ],
  play: async ({ canvas }) => {
    const button = canvas.getByText("サジェスト生成");
    button.click();
  },
};

/** エラー状態 */
export const Error: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        suggest_review_comments: () =>
          Promise.reject("LLM API connection failed"),
      });
      return <Story />;
    },
  ],
  play: async ({ canvas }) => {
    const button = canvas.getByText("サジェスト生成");
    button.click();
  },
};

/** サジェストあり */
export const WithSuggestions: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        suggest_review_comments: () => fixtures.reviewSuggestions,
      });
      return <Story />;
    },
  ],
  play: async ({ canvas }) => {
    const button = canvas.getByText("サジェスト生成");
    button.click();
  },
};

/** サジェストあり + コメント挿入コールバック */
export const WithInsertComment: Story = {
  args: {
    onInsertComment: fn(),
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        suggest_review_comments: () => fixtures.reviewSuggestions,
      });
      return <Story />;
    },
  ],
  play: async ({ canvas }) => {
    const button = canvas.getByText("サジェスト生成");
    button.click();
  },
};

/** サジェストなし（空配列） */
export const Empty: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        suggest_review_comments: () => [],
      });
      return <Story />;
    },
  ],
  play: async ({ canvas }) => {
    const button = canvas.getByText("サジェスト生成");
    button.click();
  },
};
