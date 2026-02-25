import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Layout } from "./Layout";
import { fixtures } from "../storybook/fixtures";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "repository.selectPrompt": "リポジトリを選択してください",
        "app.title": "reown",
        "app.tagline": "tagline",
        "repository.title": "Repositories",
        "repository.empty": "リポジトリがありません",
        "repository.add": "リポジトリを追加",
        "repository.remove": "削除",
      };
      return translations[key] ?? key;
    },
  }),
}));

const navItems = [
  { id: "worktree", labelKey: "nav.worktree", shortcut: "1" },
  { id: "branch", labelKey: "nav.branch", shortcut: "2" },
];

const defaultProps = {
  repositories: fixtures.repositories,
  selectedRepoPath: "/Users/dev/project",
  onSelectRepo: vi.fn(),
  onAddRepo: vi.fn(),
  onRemoveRepo: vi.fn(),
  navItems,
  activeTabId: "worktree",
  onSelectTab: vi.fn(),
};

describe("Layout", () => {
  it("renders sidebar and content area", () => {
    render(
      <Layout {...defaultProps}>
        <div>Content</div>
      </Layout>
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "reown"
    );
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders tab bar when repo is selected", () => {
    render(
      <Layout {...defaultProps}>
        <div>Content</div>
      </Layout>
    );
    expect(screen.getByText("nav.worktree")).toBeInTheDocument();
    expect(screen.getByText("nav.branch")).toBeInTheDocument();
  });

  it("shows select prompt when no repo is selected", () => {
    render(
      <Layout {...defaultProps} selectedRepoPath={null}>
        <div>Content</div>
      </Layout>
    );
    expect(
      screen.getByText("リポジトリを選択してください")
    ).toBeInTheDocument();
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("renders branch selector when provided", () => {
    render(
      <Layout {...defaultProps} branchSelector={<div>Branch Selector</div>}>
        <div>Content</div>
      </Layout>
    );
    expect(screen.getByText("Branch Selector")).toBeInTheDocument();
  });

  it("does not render branch selector when not provided", () => {
    render(
      <Layout {...defaultProps}>
        <div>Content</div>
      </Layout>
    );
    expect(screen.queryByText("Branch Selector")).not.toBeInTheDocument();
  });
});
