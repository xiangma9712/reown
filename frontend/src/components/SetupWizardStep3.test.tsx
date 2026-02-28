import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetupWizardStep3 } from "./SetupWizardStep3";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "onboarding.step3Title": "LLM設定",
        "onboarding.step3Description": "APIキーを設定します。",
        "onboarding.step3TestSuccess": "接続テストに成功しました",
        "onboarding.step3SaveSuccess": "LLM設定を保存しました",
        "onboarding.step3SkipNote":
          "スキップしても、あとから設定画面でLLM設定を行えます。",
        "onboarding.skip": "スキップ",
        "onboarding.next": "次へ",
        "llmSettings.endpoint": "エンドポイントURL",
        "llmSettings.model": "モデル名",
        "llmSettings.apiKey": "APIキー",
        "llmSettings.apiKeyPlaceholder": "APIキーを入力",
        "llmSettings.testConnection": "接続テスト",
        "llmSettings.showApiKey": "表示",
        "llmSettings.hideApiKey": "非表示",
      };
      if (key === "onboarding.step3TestError" && params) {
        return `接続テストに失敗しました: ${params.message}`;
      }
      if (key === "onboarding.step3SaveError" && params) {
        return `LLM設定の保存に失敗しました: ${params.message}`;
      }
      return translations[key] ?? key;
    },
  }),
}));

const mockInvokeFn = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvokeFn(...args),
}));

describe("SetupWizardStep3", () => {
  const defaultProps = {
    onNext: vi.fn(),
    onSkip: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the title and description", () => {
    render(<SetupWizardStep3 {...defaultProps} />);
    expect(screen.getByText("LLM設定")).toBeInTheDocument();
    expect(screen.getByText("APIキーを設定します。")).toBeInTheDocument();
  });

  it("renders input fields with default values", () => {
    render(<SetupWizardStep3 {...defaultProps} />);
    const endpointInput = screen.getByDisplayValue("https://api.anthropic.com");
    expect(endpointInput).toBeInTheDocument();
    const modelInput = screen.getByDisplayValue("claude-sonnet-4-5-20250929");
    expect(modelInput).toBeInTheDocument();
  });

  it("renders API key input and test connection button", () => {
    render(<SetupWizardStep3 {...defaultProps} />);
    expect(screen.getByPlaceholderText("APIキーを入力")).toBeInTheDocument();
    expect(screen.getByText("接続テスト")).toBeInTheDocument();
  });

  it("renders skip button", () => {
    render(<SetupWizardStep3 {...defaultProps} />);
    expect(screen.getByText("スキップ")).toBeInTheDocument();
  });

  it("calls onSkip when skip button is clicked", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<SetupWizardStep3 {...defaultProps} onSkip={onSkip} />);
    await user.click(screen.getByText("スキップ"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("shows skip note when test has not succeeded", () => {
    render(<SetupWizardStep3 {...defaultProps} />);
    expect(
      screen.getByText("スキップしても、あとから設定画面でLLM設定を行えます。")
    ).toBeInTheDocument();
    expect(screen.queryByText("次へ")).not.toBeInTheDocument();
  });

  it("runs test connection and shows success", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockResolvedValueOnce(undefined);
    render(<SetupWizardStep3 {...defaultProps} />);
    await user.click(screen.getByText("接続テスト"));
    await waitFor(() => {
      expect(screen.getByText("接続テストに成功しました")).toBeInTheDocument();
    });
    expect(mockInvokeFn).toHaveBeenCalledWith("test_llm_connection", {
      endpoint: "https://api.anthropic.com",
      model: "claude-sonnet-4-5-20250929",
      apiKey: undefined,
    });
  });

  it("shows next button after successful test", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockResolvedValueOnce(undefined);
    render(<SetupWizardStep3 {...defaultProps} />);
    await user.click(screen.getByText("接続テスト"));
    await waitFor(() => {
      expect(screen.getByText("次へ")).toBeInTheDocument();
    });
  });

  it("shows error message when test fails", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockRejectedValueOnce(new Error("Invalid API key"));
    render(<SetupWizardStep3 {...defaultProps} />);
    await user.click(screen.getByText("接続テスト"));
    await waitFor(() => {
      expect(
        screen.getByText(/接続テストに失敗しました:.*Invalid API key/)
      ).toBeInTheDocument();
    });
  });

  it("does not show next button after test failure", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockRejectedValueOnce(new Error("fail"));
    render(<SetupWizardStep3 {...defaultProps} />);
    await user.click(screen.getByText("接続テスト"));
    await waitFor(() => {
      expect(screen.getByText(/接続テストに失敗しました/)).toBeInTheDocument();
    });
    expect(screen.queryByText("次へ")).not.toBeInTheDocument();
  });

  it("saves config and calls onNext on next button click", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    // First call: test_llm_connection, subsequent: save_llm_config
    mockInvokeFn.mockResolvedValue(undefined);
    render(<SetupWizardStep3 {...defaultProps} onNext={onNext} />);

    // First test connection
    await user.click(screen.getByText("接続テスト"));
    await waitFor(() => {
      expect(screen.getByText("次へ")).toBeInTheDocument();
    });

    // Click next (which triggers save)
    await user.click(screen.getByText("次へ"));
    await waitFor(() => {
      expect(onNext).toHaveBeenCalledTimes(1);
    });
    expect(mockInvokeFn).toHaveBeenCalledWith("save_llm_config", {
      llmConfig: {
        llm_endpoint: "https://api.anthropic.com",
        llm_model: "claude-sonnet-4-5-20250929",
        llm_api_key_stored: false,
      },
    });
  });

  it("saves API key when provided", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockResolvedValue(undefined);
    render(<SetupWizardStep3 {...defaultProps} />);

    // Enter API key
    await user.type(
      screen.getByPlaceholderText("APIキーを入力"),
      "sk-test-key"
    );

    // Test connection
    await user.click(screen.getByText("接続テスト"));
    await waitFor(() => {
      expect(screen.getByText("次へ")).toBeInTheDocument();
    });

    // Save
    await user.click(screen.getByText("次へ"));
    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith("save_llm_api_key", {
        apiKey: "sk-test-key",
      });
    });
  });

  it("shows save error when save fails", async () => {
    const user = userEvent.setup();
    mockInvokeFn
      .mockResolvedValueOnce(undefined) // test_llm_connection succeeds
      .mockRejectedValueOnce(new Error("Save failed")); // save_llm_config fails
    render(<SetupWizardStep3 {...defaultProps} />);

    await user.click(screen.getByText("接続テスト"));
    await waitFor(() => {
      expect(screen.getByText("次へ")).toBeInTheDocument();
    });

    await user.click(screen.getByText("次へ"));
    await waitFor(() => {
      expect(
        screen.getByText(/LLM設定の保存に失敗しました:.*Save failed/)
      ).toBeInTheDocument();
    });
  });

  it("toggles API key visibility", async () => {
    const user = userEvent.setup();
    render(<SetupWizardStep3 {...defaultProps} />);
    const apiKeyInput = screen.getByPlaceholderText("APIキーを入力");
    expect(apiKeyInput).toHaveAttribute("type", "password");
    await user.click(screen.getByText("表示"));
    expect(apiKeyInput).toHaveAttribute("type", "text");
    await user.click(screen.getByText("非表示"));
    expect(apiKeyInput).toHaveAttribute("type", "password");
  });

  it("sends custom endpoint and model in test connection", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockResolvedValueOnce(undefined);
    render(<SetupWizardStep3 {...defaultProps} />);

    const endpointInput = screen.getByDisplayValue("https://api.anthropic.com");
    const modelInput = screen.getByDisplayValue("claude-sonnet-4-5-20250929");

    await user.clear(endpointInput);
    await user.type(endpointInput, "https://custom.api.com");
    await user.clear(modelInput);
    await user.type(modelInput, "custom-model");

    await user.click(screen.getByText("接続テスト"));
    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith("test_llm_connection", {
        endpoint: "https://custom.api.com",
        model: "custom-model",
        apiKey: undefined,
      });
    });
  });
});
