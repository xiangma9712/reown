import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SetupWizardStep4 } from "./SetupWizardStep4";
vi.mock("react-i18next", async () => {
  const { i18nMock } = await import("../test/i18n-mock");
  return i18nMock;
});

describe("SetupWizardStep4", () => {
  it("renders the complete title and description", () => {
    render(<SetupWizardStep4 onComplete={vi.fn()} />);
    expect(screen.getByText("セットアップ完了！")).toBeInTheDocument();
    expect(
      screen.getByText("reownの設定が完了しました。さっそく使い始めましょう。")
    ).toBeInTheDocument();
  });

  it("renders the complete button", () => {
    render(<SetupWizardStep4 onComplete={vi.fn()} />);
    expect(screen.getByText("はじめる")).toBeInTheDocument();
  });

  it("calls onComplete when complete button is clicked", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<SetupWizardStep4 onComplete={onComplete} />);
    await user.click(screen.getByText("はじめる"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not render next or skip buttons", () => {
    render(<SetupWizardStep4 onComplete={vi.fn()} />);
    expect(screen.queryByText("次へ")).not.toBeInTheDocument();
    expect(screen.queryByText("スキップ")).not.toBeInTheDocument();
    expect(screen.queryByText("戻る")).not.toBeInTheDocument();
  });
});
