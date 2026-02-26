import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge";

const meta = {
  title: "Components/Badge",
  component: Badge,
  args: {
    children: "Badge",
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト */
export const Default: Story = {};

/** Success */
export const Success: Story = {
  args: { variant: "success", children: "Added" },
};

/** Warning */
export const Warning: Story = {
  args: { variant: "warning", children: "Modified" },
};

/** Danger */
export const Danger: Story = {
  args: { variant: "danger", children: "Deleted" },
};

/** Info */
export const Info: Story = {
  args: { variant: "info", children: "Renamed" },
};

/** Purple */
export const Purple: Story = {
  args: { variant: "purple", children: "Merged" },
};
