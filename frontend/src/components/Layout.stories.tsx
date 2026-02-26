import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Layout } from "./Layout";
import { fixtures } from "../storybook/fixtures";

const navItems = [
  { id: "review", labelKey: "tabs.review", shortcut: "1" },
  { id: "next-action", labelKey: "tabs.nextAction", shortcut: "2" },
];

const meta = {
  title: "Components/Layout",
  component: Layout,
  args: {
    repositories: fixtures.repositories,
    selectedRepoPath: fixtures.repositories[0].path,
    onSelectRepo: fn(),
    onAddRepo: fn(),
    onRemoveRepo: fn(),
    navItems,
    activeTabId: "review",
    onSelectTab: fn(),
    children: (
      <div className="p-4 text-text-secondary">メインコンテンツ領域</div>
    ),
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Layout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRepo: Story = {};

export const NoRepoSelected: Story = {
  args: {
    selectedRepoPath: null,
  },
};

export const WithBranchSelector: Story = {
  args: {
    branchSelector: <span className="text-sm text-text-secondary">main</span>,
  },
};

export const MobileWithRepo: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

export const MobileNoRepo: Story = {
  args: {
    selectedRepoPath: null,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

export const SidebarCollapsed: Story = {
  decorators: [
    (Story) => {
      localStorage.setItem("reown-sidebar-collapsed", "true");
      return <Story />;
    },
  ],
};

export const SidebarResized: Story = {
  decorators: [
    (Story) => {
      localStorage.setItem("reown-sidebar-width", "360");
      localStorage.removeItem("reown-sidebar-collapsed");
      return <Story />;
    },
  ],
};
