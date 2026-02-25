import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText("Label")).toBeInTheDocument();
  });

  it("uses default variant when none specified", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it.each(["success", "warning", "danger", "info", "purple", "default"] as const)(
    "renders %s variant",
    (variant) => {
      render(<Badge variant={variant}>Badge</Badge>);
      expect(screen.getByText("Badge")).toBeInTheDocument();
    }
  );

  it("applies custom className", () => {
    render(<Badge className="custom-class">Styled</Badge>);
    expect(screen.getByText("Styled")).toHaveClass("custom-class");
  });
});
