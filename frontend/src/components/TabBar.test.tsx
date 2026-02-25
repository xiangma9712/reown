import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TabBar } from "./TabBar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "tabs.review": "Review",
        "tabs.nextAction": "Next Action",
      };
      return translations[key] ?? key;
    },
  }),
}));

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

  it("highlights the active tab", () => {
    const { container } = render(
      <TabBar items={items} activeId="next-action" onSelect={vi.fn()} />
    );
    const activeTab = container.querySelector(".border-b-accent");
    expect(activeTab).toBeInTheDocument();
    expect(activeTab?.textContent).toContain("Next Action");
  });

  it("calls onSelect when a tab is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TabBar items={items} activeId="review" onSelect={onSelect} />);
    await user.click(screen.getByText("Next Action"));
    expect(onSelect).toHaveBeenCalledWith("next-action");
  });
});
