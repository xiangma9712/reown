import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Layout } from "./Layout";
import { fixtures } from "../storybook/fixtures";
vi.mock("react-i18next", async () => {
  const { i18nMock } = await import("../test/i18n-mock");
  return i18nMock;
});

const navItems = [
  { id: "review", labelKey: "nav.review", shortcut: "R" },
  { id: "next-action", labelKey: "nav.nextAction", shortcut: "N" },
];

const defaultProps = {
  repositories: fixtures.repositories,
  selectedRepoPath: "/Users/dev/project",
  onSelectRepo: vi.fn(),
  onAddRepo: vi.fn(),
  onRemoveRepo: vi.fn(),
  navItems,
  activeTabId: "review",
  onSelectTab: vi.fn(),
};

describe("Layout", () => {
  it("renders sidebar and content area", () => {
    render(
      <Layout {...defaultProps}>
        <div>Content</div>
      </Layout>
    );
    const allReown = screen.getAllByText("reown");
    expect(allReown.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders tab bar when repo is selected", () => {
    render(
      <Layout {...defaultProps}>
        <div>Content</div>
      </Layout>
    );
    expect(screen.getByText("nav.review")).toBeInTheDocument();
    expect(screen.getByText("nav.nextAction")).toBeInTheDocument();
  });

  it("shows select prompt when no repo is selected", () => {
    render(
      <Layout {...defaultProps} selectedRepoPath={null}>
        <div>Content</div>
      </Layout>
    );
    expect(
      screen.getByText("左のサイドメニューからリポジトリを選択してください。")
    ).toBeInTheDocument();
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("renders tabpanel with correct aria attributes", () => {
    render(
      <Layout {...defaultProps} activeTabId="review">
        <div>Content</div>
      </Layout>
    );
    const tabpanel = screen.getByRole("tabpanel");
    expect(tabpanel).toHaveAttribute("id", "tabpanel-review");
    expect(tabpanel).toHaveAttribute("aria-labelledby", "tab-review");
  });

  it("renders hamburger buttons for mobile sidebar", () => {
    render(
      <Layout {...defaultProps}>
        <div>Content</div>
      </Layout>
    );
    const hamburgerButtons = screen.getAllByLabelText("サイドバーを開く");
    expect(hamburgerButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("opens drawer when hamburger button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Layout {...defaultProps}>
        <div>Content</div>
      </Layout>
    );
    const hamburgerButtons = screen.getAllByLabelText("サイドバーを開く");
    await user.click(hamburgerButtons[0]);
    // Drawer should render a close button
    expect(screen.getByLabelText("サイドバーを閉じる")).toBeInTheDocument();
  });

  it("closes drawer when close button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Layout {...defaultProps}>
        <div>Content</div>
      </Layout>
    );
    const hamburgerButtons = screen.getAllByLabelText("サイドバーを開く");
    await user.click(hamburgerButtons[0]);
    const closeButton = screen.getByLabelText("サイドバーを閉じる");
    await user.click(closeButton);
    expect(
      screen.queryByLabelText("サイドバーを閉じる")
    ).not.toBeInTheDocument();
  });

  it("closes drawer on Escape key", async () => {
    const user = userEvent.setup();
    render(
      <Layout {...defaultProps}>
        <div>Content</div>
      </Layout>
    );
    const hamburgerButtons = screen.getAllByLabelText("サイドバーを開く");
    await user.click(hamburgerButtons[0]);
    expect(screen.getByLabelText("サイドバーを閉じる")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByLabelText("サイドバーを閉じる")
    ).not.toBeInTheDocument();
  });

  it("renders hamburger button when no repo selected", () => {
    render(
      <Layout {...defaultProps} selectedRepoPath={null}>
        <div>Content</div>
      </Layout>
    );
    const hamburgerButtons = screen.getAllByLabelText("サイドバーを開く");
    expect(hamburgerButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders resize handle for desktop sidebar", () => {
    render(
      <Layout {...defaultProps}>
        <div>Content</div>
      </Layout>
    );
    expect(
      screen.getByRole("separator", { name: "サイドバーの幅を調整" })
    ).toBeInTheDocument();
  });

  it("does not render resize handle when sidebar is collapsed", () => {
    localStorage.setItem("reown-sidebar-collapsed", "true");
    render(
      <Layout {...defaultProps}>
        <div>Content</div>
      </Layout>
    );
    expect(
      screen.queryByRole("separator", { name: "サイドバーの幅を調整" })
    ).not.toBeInTheDocument();
    localStorage.removeItem("reown-sidebar-collapsed");
  });
});
