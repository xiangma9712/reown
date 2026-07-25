import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RerunWizardSection } from "./RerunWizardSection";

vi.mock("react-i18next", async () => {
  const { i18nMock } = await import("../test/i18n-mock");
  return i18nMock;
});

describe("RerunWizardSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the section title, description and button", () => {
    render(<RerunWizardSection onRerun={vi.fn()} />);
    expect(screen.getByText("セットアップウィザード")).toBeInTheDocument();
    expect(
      screen.getByText("初期セットアップウィザードを再度表示し、設定をやり直します。")
    ).toBeInTheDocument();
    expect(
      screen.getByText("セットアップウィザードを再実行")
    ).toBeInTheDocument();
  });

  it("opens confirm dialog on button click and calls onRerun on confirm", async () => {
    const onRerun = vi.fn();
    render(<RerunWizardSection onRerun={onRerun} />);

    const button = screen.getByText("セットアップウィザードを再実行");
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText("セットアップウィザードを再実行しますか？")
      ).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", { name: "再実行" });
    fireEvent.click(confirmButton);

    expect(onRerun).toHaveBeenCalledTimes(1);
  });
});
