import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  args: {
    children: "ボタン",
    onClick: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "セカンダリ",
  },
};

export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "削除",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "ゴースト",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    children: "小さい",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    children: "大きい",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "無効",
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: "読み込み中",
  },
};

export const Filter: Story = {
  args: {
    variant: "filter",
    size: "sm",
    children: "フィルター",
  },
};

export const FilterActive: Story = {
  args: {
    variant: "filter",
    size: "sm",
    active: true,
    children: "フィルター（選択中）",
  },
};

export const Tab: Story = {
  args: {
    variant: "tab",
    size: "sm",
    children: "タブ",
  },
};

export const TabActive: Story = {
  args: {
    variant: "tab",
    size: "sm",
    active: true,
    children: "タブ（選択中）",
  },
};

/**
 * active prop は filter / tab 以外の variant では無視される。
 * 以下のストーリーは、active={true} を渡しても見た目が変わらないことを明示する。
 */
export const PrimaryActiveIgnored: Story = {
  args: {
    variant: "primary",
    active: true,
    children: "Primary (active無視)",
  },
};

export const SecondaryActiveIgnored: Story = {
  args: {
    variant: "secondary",
    active: true,
    children: "Secondary (active無視)",
  },
};

export const DestructiveActiveIgnored: Story = {
  args: {
    variant: "destructive",
    active: true,
    children: "Destructive (active無視)",
  },
};

export const GhostActiveIgnored: Story = {
  args: {
    variant: "ghost",
    active: true,
    children: "Ghost (active無視)",
  },
};
