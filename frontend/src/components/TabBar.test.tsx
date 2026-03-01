import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TabBar } from "./TabBar";
vi.mock("react-i18next", async () => {
  const { i18nMock } = await import("../test/i18n-mock");
  return i18nMock;
});

const items = [
  { id: "review", labelKey: "tabs.review", shortcut: "R" },
  { id: "next-action", labelKey: "tabs.nextAction", shortcut: "N" },
];

describe("TabBar", () => {
  it("renders all tab items", () => {
    render(<TabBar items={items} activeId="review" onSelect={vi.fn()} />);
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Next Action")).toBeInTheDocument();
  });

  it("renders keyboard shortcuts", () => {
    render(<TabBar items={items} activeId="review" onSelect={vi.fn()} />);
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("N")).toBeInTheDocument();
  });

  it("highlights the active tab with border, background and bold", () => {
    const { container } = render(
      <TabBar items={items} activeId="next-action" onSelect={vi.fn()} />
    );
    const activeTab = container.querySelector(".border-b-accent");
    expect(activeTab).toBeInTheDocument();
    expect(activeTab?.textContent).toContain("Next Action");
    expect(activeTab).toHaveClass("bg-bg-hover");
    expect(activeTab).toHaveClass("font-bold");
  });

  it("calls onSelect when a tab is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TabBar items={items} activeId="review" onSelect={onSelect} />);
    await user.click(screen.getByText("Next Action"));
    expect(onSelect).toHaveBeenCalledWith("next-action");
  });

  it("has role=tablist on container and role=tab on buttons", () => {
    render(<TabBar items={items} activeId="review" onSelect={vi.fn()} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
  });

  it("sets aria-selected on the active tab", () => {
    render(<TabBar items={items} activeId="review" onSelect={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
  });

  it("sets aria-controls and id on each tab", () => {
    render(<TabBar items={items} activeId="review" onSelect={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("id", "tab-review");
    expect(tabs[0]).toHaveAttribute("aria-controls", "tabpanel-review");
    expect(tabs[1]).toHaveAttribute("id", "tab-next-action");
    expect(tabs[1]).toHaveAttribute("aria-controls", "tabpanel-next-action");
  });

  it("has aria-keyshortcuts on each tab", () => {
    render(<TabBar items={items} activeId="review" onSelect={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-keyshortcuts", "R");
    expect(tabs[1]).toHaveAttribute("aria-keyshortcuts", "N");
  });

  it("hides kbd shortcuts from screen readers", () => {
    const { container } = render(
      <TabBar items={items} activeId="review" onSelect={vi.fn()} />
    );
    const kbds = container.querySelectorAll("kbd");
    kbds.forEach((kbd) => {
      expect(kbd).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("renders keyboard icon inside shortcut badges", () => {
    const { container } = render(
      <TabBar items={items} activeId="review" onSelect={vi.fn()} />
    );
    const kbds = container.querySelectorAll("kbd");
    kbds.forEach((kbd) => {
      expect(kbd.querySelector("svg")).toBeInTheDocument();
    });
  });

  it("sets tabIndex=0 on active tab and tabIndex=-1 on inactive tabs", () => {
    render(<TabBar items={items} activeId="review" onSelect={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
  });

  it("navigates to next tab on ArrowRight", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TabBar items={items} activeId="review" onSelect={onSelect} />);
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(onSelect).toHaveBeenCalledWith("next-action");
  });

  it("navigates to previous tab on ArrowLeft (wraps)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TabBar items={items} activeId="review" onSelect={onSelect} />);
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    await user.keyboard("{ArrowLeft}");
    expect(onSelect).toHaveBeenCalledWith("next-action");
  });

  it("navigates to first tab on Home", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TabBar items={items} activeId="next-action" onSelect={onSelect} />);
    const tabs = screen.getAllByRole("tab");
    tabs[1].focus();
    await user.keyboard("{Home}");
    expect(onSelect).toHaveBeenCalledWith("review");
  });

  it("navigates to last tab on End", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TabBar items={items} activeId="review" onSelect={onSelect} />);
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    await user.keyboard("{End}");
    expect(onSelect).toHaveBeenCalledWith("next-action");
  });

  it("wraps from last tab to first on ArrowRight", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TabBar items={items} activeId="next-action" onSelect={onSelect} />);
    const tabs = screen.getAllByRole("tab");
    tabs[1].focus();
    await user.keyboard("{ArrowRight}");
    expect(onSelect).toHaveBeenCalledWith("review");
  });
});
