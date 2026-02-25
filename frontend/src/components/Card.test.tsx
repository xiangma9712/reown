import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Card, Panel } from "./Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Card className="extra">Content</Card>);
    expect(screen.getByText("Content").closest("section")).toHaveClass("extra");
  });
});

describe("Panel", () => {
  it("renders children", () => {
    render(<Panel>Panel content</Panel>);
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Panel className="extra">Content</Panel>);
    expect(screen.getByText("Content").closest("div")).toHaveClass("extra");
  });
});
