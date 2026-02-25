import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  overrideInvoke,
  resetInvokeOverrides,
  emitMockEvent,
  fixtures,
} from "../storybook";
import { ChangeSummaryList } from "./ChangeSummaryList";

const defaultArgs = {
  owner: "example",
  repo: "reown",
  prNumber: 42,
  token: "test-token",
  diffs: fixtures.categorizedFileDiffs,
};

const meta = {
  title: "Components/ChangeSummaryList",
  component: ChangeSummaryList,
  args: defaultArgs,
  beforeEach: () => {
    resetInvokeOverrides();
  },
} satisfies Meta<typeof ChangeSummaryList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト状態: 生成ボタン表示 */
export const Default: Story = {};

/** 要約表示済み: autoGenerate有効 */
export const WithSummary: Story = {
  args: {
    autoGenerate: true,
  },
};

/** ストリーミング中: LLMがテキストを生成中 */
export const Streaming: Story = {
  args: {
    autoGenerate: true,
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        summarize_pull_request: () =>
          new Promise(() => {
            // Never resolves to keep loading state
          }),
      });
      return (
        <StreamingSimulator prNumber={42}>
          <Story />
        </StreamingSimulator>
      );
    },
  ],
};

/** ストリーミングシミュレーション用ヘルパー */
function StreamingSimulator({
  prNumber,
  children,
}: {
  prNumber: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const chunks = [
      "認証機能を追加する",
      "PRです。\n\n",
      "JWTトークンによる認証基盤の実装と、",
      "ログインフォームUIの追加を含みます。",
    ];
    let i = 0;
    const timer = setInterval(() => {
      if (i < chunks.length) {
        emitMockEvent(`summary-stream-${prNumber}`, chunks[i]);
        i++;
      } else {
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [prNumber]);

  return <>{children}</>;
}

/** 空状態: diff なし */
export const EmptyDiffs: Story = {
  args: {
    diffs: [],
  },
};

/** エラー状態 */
export const ErrorState: Story = {
  args: {
    autoGenerate: true,
  },
  decorators: [
    (Story) => {
      overrideInvoke({
        summarize_pull_request: () => {
          throw new Error("LLM接続に失敗しました");
        },
      });
      return <Story />;
    },
  ],
};
