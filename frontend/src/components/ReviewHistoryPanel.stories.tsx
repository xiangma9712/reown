import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReviewHistoryPanel } from "./ReviewHistoryPanel";
import { fixtures } from "../storybook";

const meta = {
  title: "Components/ReviewHistoryPanel",
  component: ReviewHistoryPanel,
  args: {
    records: fixtures.reviewRecords,
  },
} satisfies Meta<typeof ReviewHistoryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** レビュー履歴あり */
export const WithRecords: Story = {};

/** 空の履歴 */
export const Empty: Story = {
  args: {
    records: [],
  },
};
