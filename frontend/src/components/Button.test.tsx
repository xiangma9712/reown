import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole("button", { name: "Click me" })
    ).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    await user.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when loading is true", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  describe("variants", () => {
    it.each(["primary", "secondary", "destructive", "ghost"] as const)(
      "renders %s variant",
      (variant) => {
        render(<Button variant={variant}>Btn</Button>);
        expect(screen.getByRole("button", { name: "Btn" })).toBeInTheDocument();
      }
    );
  });

  describe("sizes", () => {
    it.each(["sm", "md", "lg"] as const)("renders %s size", (size) => {
      render(<Button size={size}>Btn</Button>);
      expect(screen.getByRole("button", { name: "Btn" })).toBeInTheDocument();
    });
  });
});
