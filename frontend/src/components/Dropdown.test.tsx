import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Dropdown, type DropdownItem } from "./Dropdown";

describe("Dropdown", () => {
  const items: DropdownItem[] = [
    { label: "Edit", onSelect: vi.fn() },
    { label: "Delete", onSelect: vi.fn(), variant: "danger" },
  ];

  it("renders the trigger element", () => {
    render(<Dropdown trigger={<button>Open</button>} items={items} />);
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("shows menu items when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger={<button>Open</button>} items={items} />);

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("calls onSelect when an item is clicked", async () => {
    const user = userEvent.setup();
    const onSelectEdit = vi.fn();
    const testItems: DropdownItem[] = [
      { label: "Edit", onSelect: onSelectEdit },
    ];
    render(<Dropdown trigger={<button>Open</button>} items={testItems} />);

    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(screen.getByText("Edit"));
    expect(onSelectEdit).toHaveBeenCalledTimes(1);
  });

  it("does not show menu items before trigger is clicked", () => {
    render(<Dropdown trigger={<button>Open</button>} items={items} />);
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });
});
