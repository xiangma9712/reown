import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TabBar } from "./TabBar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "nav.worktree": "Worktree",
        "nav.branch": "Branch",
        "nav.diff": "Diff",
      };
      return translations[key] ?? key;
    },
  }),
}));

const items = [
  { id: "worktree", labelKey: "nav.worktree", shortcut: "1" },
  { id: "branch", labelKey: "nav.branch", shortcut: "2" },
  { id: "diff", labelKey: "nav.diff", shortcut: "3" },
];

describe("TabBar", () => {
  it("renders all tab items", () => {
    render(<TabBar items={items} activeId="worktree" onSelect={vi.fn()} />);
    expect(screen.getByText("Worktree")).toBeInTheDocument();
    expect(screen.getByText("Branch")).toBeInTheDocument();
    expect(screen.getByText("Diff")).toBeInTheDocument();
  });

  it("renders keyboard shortcuts", () => {
    render(<TabBar items={items} activeId="worktree" onSelect={vi.fn()} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("highlights the active tab", () => {
    const { container } = render(
      <TabBar items={items} activeId="branch" onSelect={vi.fn()} />
    );
    const activeTab = container.querySelector(".border-b-accent");
    expect(activeTab).toBeInTheDocument();
    expect(activeTab?.textContent).toContain("Branch");
  });

  it("calls onSelect when a tab is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TabBar items={items} activeId="worktree" onSelect={onSelect} />);
    await user.click(screen.getByText("Diff"));
    expect(onSelect).toHaveBeenCalledWith("diff");
  });
});
