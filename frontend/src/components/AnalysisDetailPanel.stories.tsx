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

/** リスクスコア Low（緑ゲージ） */
export const RiskLow: Story = {
  args: {
    result: {
      ...fixtures.analysisResult,
      risk: {
        ...fixtures.analysisResult.risk,
        score: 15,
        level: "Low",
      },
    },
  },
};

/** リスクスコア High（赤ゲージ） */
export const RiskHigh: Story = {
  args: {
    result: {
      ...fixtures.analysisResult,
      risk: {
        ...fixtures.analysisResult.risk,
        score: 80,
        level: "High",
      },
    },
  },
};
