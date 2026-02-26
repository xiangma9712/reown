import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Sidebar } from "./Sidebar";
import { fixtures } from "../storybook/fixtures";

const meta = {
  title: "Components/Sidebar",
  component: Sidebar,
  args: {
    repositories: fixtures.repositories,
    selectedPath: null,
    onSelect: fn(),
    onAdd: fn(),
    onRemove: fn(),
    onToggleSettings: fn(),
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    repositories: [],
  },
};

export const Selected: Story = {
  args: {
    selectedPath: fixtures.repositories[0].path,
  },
};

export const SettingsOpen: Story = {
  args: {
    settingsOpen: true,
  },
};

export const LongRepoName: Story = {
  args: {
    repositories: [
      {
        name: "my-very-long-repository-name-that-exceeds-sidebar-width",
        path: "/Users/dev/workspace/organizations/my-company/my-very-long-repository-name-that-exceeds-sidebar-width",
      },
      ...fixtures.repositories,
    ],
  },
};

export const WithCloseButton: Story = {
  args: {
    onClose: fn(),
  },
};

export const Collapsed: Story = {
  args: {
    collapsed: true,
    onToggleCollapse: fn(),
    selectedPath: fixtures.repositories[0].path,
  },
};

export const CollapsedWithToggle: Story = {
  args: {
    collapsed: false,
    onToggleCollapse: fn(),
  },
};

export const Adding: Story = {
  args: {
    adding: true,
  },
};

export const AddError: Story = {
  args: {
    addError:
      "リポジトリの追加に失敗しました。Gitリポジトリであることを確認してください。",
    onDismissAddError: fn(),
  },
};

export const CollapsedAdding: Story = {
  args: {
    collapsed: true,
    onToggleCollapse: fn(),
    adding: true,
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const CollapsedLoading: Story = {
  args: {
    collapsed: true,
    onToggleCollapse: fn(),
    loading: true,
  },
};

export const CollapsedEmpty: Story = {
  args: {
    collapsed: true,
    onToggleCollapse: fn(),
    repositories: [],
  },
};

export const CollapsedSettingsOpen: Story = {
  args: {
    collapsed: true,
    onToggleCollapse: fn(),
    settingsOpen: true,
  },
};

// ── Theme toggle variants ────────────────────────────────────

export const ThemeToggleLight: Story = {
  args: {
    repositories: [],
  },
};

export const ThemeToggleDark: Story = {
  args: {
    repositories: [],
  },
  globals: { theme: "dark" },
};

// ── Dark mode variants ──────────────────────────────────────

export const DarkDefault: Story = {
  globals: { theme: "dark" },
};

export const DarkSelected: Story = {
  args: {
    selectedPath: fixtures.repositories[0].path,
  },
  globals: { theme: "dark" },
};

export const DarkEmpty: Story = {
  args: {
    repositories: [],
  },
  globals: { theme: "dark" },
};

export const DarkCollapsed: Story = {
  args: {
    collapsed: true,
    onToggleCollapse: fn(),
    selectedPath: fixtures.repositories[0].path,
  },
  globals: { theme: "dark" },
};

export const DarkSettingsOpen: Story = {
  args: {
    settingsOpen: true,
  },
  globals: { theme: "dark" },
};
