import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SetupWizard } from "./SetupWizard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "onboarding.step1Title": "リポジトリ選択",
        "onboarding.step1Description":
          "レビュー対象のリポジトリを選択してください。",
        "onboarding.step2Title": "GitHub認証",
        "onboarding.step2Description": "GitHubと連携します。",
        "onboarding.step3Title": "LLM設定",
        "onboarding.step3Description": "APIキーを設定します。",
        "onboarding.completeTitle": "セットアップ完了！",
        "onboarding.completeDescription": "reownの設定が完了しました。",
        "onboarding.completeButton": "はじめる",
        "onboarding.back": "戻る",
        "onboarding.next": "次へ",
        "onboarding.skip": "スキップ",
      };
      if (key === "onboarding.stepIndicator" && params) {
        return `ステップ ${params.current} / ${params.total}`;
      }
      return translations[key] ?? key;
    },
  }),
}));

describe("SetupWizard", () => {
  it("renders step 1 (repository) by default", () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "リポジトリ選択" })
    ).toBeInTheDocument();
    expect(screen.getByText("ステップ 1 / 4")).toBeInTheDocument();
  });

  it("shows next and skip buttons on step 1, but not back", () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    expect(screen.getByText("次へ")).toBeInTheDocument();
    expect(screen.getByText("スキップ")).toBeInTheDocument();
    expect(screen.queryByText("戻る")).not.toBeInTheDocument();
  });

  it("navigates to step 2 when next is clicked", async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    await user.click(screen.getByText("次へ"));
    expect(
      screen.getByRole("heading", { name: "GitHub認証" })
    ).toBeInTheDocument();
    expect(screen.getByText("ステップ 2 / 4")).toBeInTheDocument();
  });

  it("shows back button on step 2", async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    await user.click(screen.getByText("次へ"));
    expect(screen.getByText("戻る")).toBeInTheDocument();
  });

  it("navigates back from step 2 to step 1", async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    await user.click(screen.getByText("次へ"));
    expect(
      screen.getByRole("heading", { name: "GitHub認証" })
    ).toBeInTheDocument();
    await user.click(screen.getByText("戻る"));
    expect(
      screen.getByRole("heading", { name: "リポジトリ選択" })
    ).toBeInTheDocument();
    expect(screen.getByText("ステップ 1 / 4")).toBeInTheDocument();
  });

  it("navigates to step 3 via skip", async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    await user.click(screen.getByText("スキップ"));
    expect(
      screen.getByRole("heading", { name: "GitHub認証" })
    ).toBeInTheDocument();
    await user.click(screen.getByText("スキップ"));
    expect(
      screen.getByRole("heading", { name: "LLM設定" })
    ).toBeInTheDocument();
    expect(screen.getByText("ステップ 3 / 4")).toBeInTheDocument();
  });

  it("navigates through all steps to complete", async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    // Step 1 -> 2
    await user.click(screen.getByText("次へ"));
    expect(
      screen.getByRole("heading", { name: "GitHub認証" })
    ).toBeInTheDocument();
    // Step 2 -> 3
    await user.click(screen.getByText("次へ"));
    expect(
      screen.getByRole("heading", { name: "LLM設定" })
    ).toBeInTheDocument();
    // Step 3 -> complete
    await user.click(screen.getByText("次へ"));
    expect(
      screen.getByRole("heading", { name: "セットアップ完了！" })
    ).toBeInTheDocument();
    expect(screen.getByText("ステップ 4 / 4")).toBeInTheDocument();
  });

  it("shows complete button on final step instead of next/skip", async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    // Navigate to complete step
    await user.click(screen.getByText("次へ"));
    await user.click(screen.getByText("次へ"));
    await user.click(screen.getByText("次へ"));
    expect(screen.getByText("はじめる")).toBeInTheDocument();
    expect(screen.queryByText("次へ")).not.toBeInTheDocument();
    expect(screen.queryByText("スキップ")).not.toBeInTheDocument();
    expect(screen.queryByText("戻る")).not.toBeInTheDocument();
  });

  it("calls onComplete when complete button is clicked", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<SetupWizard onComplete={onComplete} />);
    // Navigate to complete step
    await user.click(screen.getByText("次へ"));
    await user.click(screen.getByText("次へ"));
    await user.click(screen.getByText("次へ"));
    await user.click(screen.getByText("はじめる"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not call onComplete before reaching complete step", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<SetupWizard onComplete={onComplete} />);
    await user.click(screen.getByText("次へ"));
    await user.click(screen.getByText("次へ"));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("does not advance beyond the last step with next", async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    // Navigate to complete step
    await user.click(screen.getByText("次へ"));
    await user.click(screen.getByText("次へ"));
    await user.click(screen.getByText("次へ"));
    // Complete step only has the "はじめる" button, no next
    expect(screen.getByText("セットアップ完了！")).toBeInTheDocument();
  });

  it("does not go before step 1 with back", () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    // Back button should not be visible on step 1
    expect(screen.queryByText("戻る")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "リポジトリ選択" })
    ).toBeInTheDocument();
  });

  it("skip behaves the same as next (advances one step)", async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    await user.click(screen.getByText("スキップ"));
    expect(screen.getByText("ステップ 2 / 4")).toBeInTheDocument();
  });

  it("does not render Card on complete step", async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    await user.click(screen.getByText("次へ"));
    await user.click(screen.getByText("次へ"));
    await user.click(screen.getByText("次へ"));
    // On complete step, description should be shown but no Card with step title inside
    expect(screen.getByText("セットアップ完了！")).toBeInTheDocument();
    // The step title appears in the heading, but not in a Card placeholder
    const headings = screen.getAllByText("セットアップ完了！");
    expect(headings).toHaveLength(1);
  });
});
