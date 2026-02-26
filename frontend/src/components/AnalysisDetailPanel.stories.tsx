import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnalysisDetailPanel } from "./AnalysisDetailPanel";
import { fixtures } from "../storybook";

const meta = {
  title: "Components/AnalysisDetailPanel",
  component: AnalysisDetailPanel,
  args: {
    result: fixtures.analysisResult,
  },
} satisfies Meta<typeof AnalysisDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 静的分析のみ */
export const StaticOnly: Story = {};

/** ハイブリッド分析（LLM含む） */
export const WithHybridResult: Story = {
  args: {
    hybridResult: fixtures.hybridAnalysisResult,
  },
};
