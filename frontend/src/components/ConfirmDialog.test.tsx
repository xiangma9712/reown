import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
vi.mock("react-i18next", async () => {
  const { i18nMock } = await import("../test/i18n-mock");
  return i18nMock;
});

describe("ConfirmDialog", () => {
  const defaultProps = {
    open: true,
    message: "Are you sure?",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders the message when open", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("does not render the message when closed", () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();
  });

  it("renders confirm and cancel buttons", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "キャンセル" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "削除" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("renders custom confirm label", () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Remove" />);
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("renders children content", () => {
    render(
      <ConfirmDialog {...defaultProps}>
        <p>Extra content</p>
      </ConfirmDialog>
    );
    expect(screen.getByText("Extra content")).toBeInTheDocument();
  });

  it("renders warning icon for destructive variant", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const icon = document.querySelector("svg[aria-hidden='true']");
    expect(icon).toBeInTheDocument();
  });

  it("does not render warning icon for primary variant", () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmVariant="primary"
        confirmLabel="OK"
      />
    );
    const icon = document.querySelector("svg[aria-hidden='true']");
    expect(icon).not.toBeInTheDocument();
  });
});
