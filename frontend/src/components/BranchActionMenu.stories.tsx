import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { BranchActionMenu } from "./BranchActionMenu";

const meta = {
  title: "Components/BranchActionMenu",
  component: BranchActionMenu,
  args: {
    branchName: "feature/add-login",
    onSwitch: fn(),
    onDelete: fn(),
  },
} satisfies Meta<typeof BranchActionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongBranchName: Story = {
  args: {
    branchName: "feature/very-long-branch-name-that-might-overflow-the-ui",
  },
};
