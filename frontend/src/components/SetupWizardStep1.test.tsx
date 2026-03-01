import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SetupWizardStep1 } from "./SetupWizardStep1";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "onboarding.step1Title": "リポジトリ選択",
        "onboarding.step1Description":
          "レビュー対象のリポジトリを選択してください。",
        "onboarding.step1Placeholder": "リポジトリ選択機能は近日実装予定です。",
        "onboarding.skip": "スキップ",
        "onboarding.next": "次へ",
      };
      return translations[key] ?? key;
    },
  }),
}));

describe("SetupWizardStep1", () => {
  const defaultProps = {
    onNext: vi.fn(),
    onSkip: vi.fn(),
  };

  it("renders the title and description", () => {
    render(<SetupWizardStep1 {...defaultProps} />);
    expect(screen.getByText("リポジトリ選択")).toBeInTheDocument();
    expect(
      screen.getByText("レビュー対象のリポジトリを選択してください。")
    ).toBeInTheDocument();
  });

  it("renders placeholder text", () => {
    render(<SetupWizardStep1 {...defaultProps} />);
    expect(
      screen.getByText("リポジトリ選択機能は近日実装予定です。")
    ).toBeInTheDocument();
  });

  it("renders next and skip buttons", () => {
    render(<SetupWizardStep1 {...defaultProps} />);
    expect(screen.getByText("次へ")).toBeInTheDocument();
    expect(screen.getByText("スキップ")).toBeInTheDocument();
  });

  it("calls onNext when next button is clicked", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<SetupWizardStep1 {...defaultProps} onNext={onNext} />);
    await user.click(screen.getByText("次へ"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip when skip button is clicked", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<SetupWizardStep1 {...defaultProps} onSkip={onSkip} />);
    await user.click(screen.getByText("スキップ"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
