import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReviewSubmit } from "./ReviewSubmit";
import { overrideInvoke, resetInvokeOverrides } from "../storybook";
import { fixtures } from "../storybook";

const meta = {
  title: "Components/ReviewSubmit",
  component: ReviewSubmit,
  args: {
    matchedPr: fixtures.pullRequests[0],
    owner: "example",
    repo: "reown",
    analysisResult: fixtures.analysisResult,
    prDiffs: fixtures.categorizedFileDiffs,
  },
  decorators: [
    (Story) => {
      resetInvokeOverrides();
      return <Story />;
    },
  ],
} satisfies Meta<typeof ReviewSubmit>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト表示（ボタンのみ） */
export const Default: Story = {};

/** 送信成功 */
export const SubmitSuccess: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        submit_pr_review: () => Promise.resolve(),
        add_review_record: () => Promise.resolve(),
      });
      return <Story />;
    },
  ],
};

/** 送信エラー */
export const SubmitError: Story = {
  decorators: [
    (Story) => {
      overrideInvoke({
        submit_pr_review: () => Promise.reject("Unauthorized: Bad credentials"),
      });
      return <Story />;
    },
  ],
};

/** 分析結果なし */
export const NoAnalysis: Story = {
  args: {
    analysisResult: null,
    prDiffs: [],
  },
};
