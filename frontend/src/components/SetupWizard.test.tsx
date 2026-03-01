import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SetupWizard } from "./SetupWizard";
vi.mock("react-i18next", async () => {
  const { i18nMock } = await import("../test/i18n-mock");
  return i18nMock;
});

// Mock step components to isolate navigation logic
vi.mock("./SetupWizardStep1", () => ({
  SetupWizardStep1: ({
    onNext,
    onSkip,
  }: {
    onNext: () => void;
    onSkip: () => void;
  }) => (
    <div data-testid="step1">
      <h1>リポジトリ選択</h1>
      <button onClick={onNext}>次へ</button>
      <button onClick={onSkip}>スキップ</button>
    </div>
  ),
}));

vi.mock("./SetupWizardStep2", () => ({
  SetupWizardStep2: ({
    onNext,
    onSkip,
  }: {
    onNext: () => void;
    onSkip: () => void;
  }) => (
    <div data-testid="step2">
      <h1>GitHub認証</h1>
      <button onClick={onNext}>次へ</button>
      <button onClick={onSkip}>スキップ</button>
    </div>
  ),
}));

vi.mock("./SetupWizardStep3", () => ({
  SetupWizardStep3: ({
    onNext,
    onSkip,
  }: {
    onNext: () => void;
    onSkip: () => void;
  }) => (
    <div data-testid="step3">
      <h1>LLM設定</h1>
      <button onClick={onNext}>次へ</button>
      <button onClick={onSkip}>スキップ</button>
    </div>
  ),
}));

vi.mock("./SetupWizardStep4", () => ({
  SetupWizardStep4: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="step4">
      <h1>セットアップ完了！</h1>
      <button onClick={onComplete}>はじめる</button>
    </div>
  ),
}));

describe("SetupWizard", () => {
  it("renders step 1 (repository) by default", () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    expect(screen.getByTestId("step1")).toBeInTheDocument();
    expect(screen.getByText("ステップ 1 / 4")).toBeInTheDocument();
  });

  it("navigates to step 2 when next is clicked", async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    await user.click(screen.getByText("次へ"));
    expect(screen.getByTestId("step2")).toBeInTheDocument();
    expect(screen.getByText("ステップ 2 / 4")).toBeInTheDocument();
  });

  it("navigates to step 2 via skip", async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    await user.click(screen.getByText("スキップ"));
    expect(screen.getByTestId("step2")).toBeInTheDocument();
    expect(screen.getByText("ステップ 2 / 4")).toBeInTheDocument();
  });

  it("navigates through all steps to complete", async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    // Step 1 -> 2
    await user.click(screen.getByText("次へ"));
    expect(screen.getByTestId("step2")).toBeInTheDocument();
    // Step 2 -> 3
    await user.click(screen.getByText("次へ"));
    expect(screen.getByTestId("step3")).toBeInTheDocument();
    expect(screen.getByText("ステップ 3 / 4")).toBeInTheDocument();
    // Step 3 -> complete
    await user.click(screen.getByText("次へ"));
    expect(screen.getByTestId("step4")).toBeInTheDocument();
    expect(screen.getByText("ステップ 4 / 4")).toBeInTheDocument();
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
});
