import type { Meta, StoryObj } from "@storybook/react-vite";
import { RiskBadge } from "./RiskBadge";

const meta = {
  title: "Components/RiskBadge",
  component: RiskBadge,
} satisfies Meta<typeof RiskBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 低リスク */
export const Low: Story = {
  args: { level: "Low" },
};

/** 中リスク */
export const Medium: Story = {
  args: { level: "Medium" },
};

/** 高リスク */
export const High: Story = {
  args: { level: "High" },
};
