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

/** aria-label 付き（role="img" が自動付与される） */
export const WithAriaLabel: Story = {
  args: {
    variant: "success",
    children: "A",
    "aria-label": "追加",
  },
};

/** status-badge クラス付き（border-left スタイル） */
export const StatusBadge: Story = {
  args: {
    variant: "warning",
    children: "M",
    className: "status-badge",
    "aria-label": "変更",
  },
};
