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

export const SettingsOpen: Story = {
  args: {
    settingsOpen: true,
    onToggleSettings: fn(),
    settingsContent: (
      <div className="mx-auto max-w-xl space-y-8">
        <div className="rounded-lg border border-border bg-bg-primary p-5">
          <h2 className="text-lg font-semibold text-text-primary">LLM設定</h2>
          <p className="mt-2 text-sm text-text-muted">設定コンテンツ領域</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-primary p-5">
          <h2 className="text-lg font-semibold text-text-primary">
            オートメーション設定
          </h2>
          <p className="mt-2 text-sm text-text-muted">設定コンテンツ領域</p>
        </div>
      </div>
    ),
  },
};

export const Loading: Story = {
  args: {
    loadingRepos: true,
    repositories: [],
    selectedRepoPath: null,
  },
};

// ── Dark mode variants ──────────────────────────────────────

export const DarkWithRepo: Story = {
  globals: { theme: "dark" },
};

export const DarkNoRepoSelected: Story = {
  args: {
    selectedRepoPath: null,
  },
  globals: { theme: "dark" },
};

export const DarkSettingsOpen: Story = {
  args: {
    settingsOpen: true,
    onToggleSettings: fn(),
    settingsContent: (
      <div className="mx-auto max-w-xl space-y-8">
        <div className="rounded-lg border border-border bg-bg-primary p-5">
          <h2 className="text-lg font-semibold text-text-primary">LLM設定</h2>
          <p className="mt-2 text-sm text-text-muted">設定コンテンツ領域</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-primary p-5">
          <h2 className="text-lg font-semibold text-text-primary">
            オートメーション設定
          </h2>
          <p className="mt-2 text-sm text-text-muted">設定コンテンツ領域</p>
        </div>
      </div>
    ),
  },
  globals: { theme: "dark" },
};

export const DarkSidebarCollapsed: Story = {
  decorators: [
    (Story) => {
      localStorage.setItem("reown-sidebar-collapsed", "true");
      return <Story />;
    },
  ],
  globals: { theme: "dark" },
};
