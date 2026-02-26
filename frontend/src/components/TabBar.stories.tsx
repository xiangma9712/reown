import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { TabBar } from "./TabBar";

const tabs = [
  { id: "review", labelKey: "tabs.review", shortcut: "⌘1" },
  { id: "nextAction", labelKey: "tabs.nextAction", shortcut: "⌘2" },
  { id: "settings", labelKey: "tabs.settings", shortcut: "⌘3" },
];

const meta = {
  title: "Components/TabBar",
  component: TabBar,
  args: {
    items: tabs,
    activeId: "review",
    onSelect: fn(),
  },
} satisfies Meta<typeof TabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 最初のタブがアクティブ */
export const FirstActive: Story = {};

/** 2番目のタブがアクティブ */
export const SecondActive: Story = {
  args: { activeId: "nextAction" },
};

/** 3番目のタブがアクティブ */
export const ThirdActive: Story = {
  args: { activeId: "settings" },
};
