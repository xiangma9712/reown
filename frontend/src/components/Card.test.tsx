import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Card, CardTitle, CardContent, Panel } from "./Card";

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

describe("CardTitle", () => {
  it("renders as h2 with font-semibold", () => {
    render(<CardTitle>Title</CardTitle>);
    const el = screen.getByText("Title");
    expect(el.tagName).toBe("H2");
    expect(el).toHaveClass("font-semibold");
  });

  it("applies custom className", () => {
    render(<CardTitle className="mb-4">Title</CardTitle>);
    expect(screen.getByText("Title")).toHaveClass("mb-4");
  });
});

describe("CardContent", () => {
  it("renders as p with text-sm", () => {
    render(<CardContent>Body text</CardContent>);
    const el = screen.getByText("Body text");
    expect(el.tagName).toBe("P");
    expect(el).toHaveClass("text-sm");
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

  it("has left border for visual distinction", () => {
    render(<Panel>Content</Panel>);
    expect(screen.getByText("Content").closest("div")).toHaveClass(
      "border-l-2"
    );
  });
});
