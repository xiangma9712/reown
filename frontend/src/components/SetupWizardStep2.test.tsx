import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetupWizardStep2 } from "./SetupWizardStep2";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "onboarding.step2Title": "GitHub認証",
        "onboarding.step2Description": "GitHubと連携します。",
        "onboarding.deviceFlowStart": "GitHubでログイン",
        "onboarding.deviceFlowInstruction":
          "以下のコードをGitHubで入力してください:",
        "onboarding.deviceFlowOpenBrowser": "ブラウザで開く",
        "onboarding.deviceFlowWaiting": "認証を待っています…",
        "onboarding.deviceFlowSuccess": "GitHub認証が完了しました",
        "onboarding.deviceFlowExpired":
          "認証コードの有効期限が切れました。再度お試しください。",
        "onboarding.manualTokenLabel":
          "または、Personal Access Tokenを手動入力",
        "onboarding.manualTokenPlaceholder": "ghp_xxxxxxxxxxxxxxxxxxxx",
        "onboarding.manualTokenSave": "トークンを保存",
        "onboarding.manualTokenSaving": "保存中…",
        "onboarding.manualTokenSuccess": "トークンを保存しました",
        "onboarding.showToken": "表示",
        "onboarding.hideToken": "非表示",
        "onboarding.skip": "スキップ",
        "onboarding.skipNote":
          "スキップしても、あとから設定画面でGitHub認証を行えます。",
        "onboarding.next": "次へ",
      };
      if (key === "onboarding.deviceFlowError" && params) {
        return `認証に失敗しました: ${params.message}`;
      }
      if (key === "onboarding.manualTokenError" && params) {
        return `トークンの保存に失敗しました: ${params.message}`;
      }
      return translations[key] ?? key;
    },
  }),
}));

const mockInvokeFn = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvokeFn(...args),
}));

describe("SetupWizardStep2", () => {
  const defaultProps = {
    onNext: vi.fn(),
    onSkip: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the title and description", () => {
    render(<SetupWizardStep2 {...defaultProps} />);
    expect(screen.getByText("GitHub認証")).toBeInTheDocument();
    expect(screen.getByText("GitHubと連携します。")).toBeInTheDocument();
  });

  it("renders device flow start button", () => {
    render(<SetupWizardStep2 {...defaultProps} />);
    expect(screen.getByText("GitHubでログイン")).toBeInTheDocument();
  });

  it("renders manual token input section", () => {
    render(<SetupWizardStep2 {...defaultProps} />);
    expect(
      screen.getByText("または、Personal Access Tokenを手動入力")
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("ghp_xxxxxxxxxxxxxxxxxxxx")
    ).toBeInTheDocument();
    expect(screen.getByText("トークンを保存")).toBeInTheDocument();
  });

  it("renders skip button", () => {
    render(<SetupWizardStep2 {...defaultProps} />);
    expect(screen.getByText("スキップ")).toBeInTheDocument();
  });

  it("calls onSkip when skip button is clicked", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<SetupWizardStep2 {...defaultProps} onSkip={onSkip} />);
    await user.click(screen.getByText("スキップ"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("disables save button when token is empty", () => {
    render(<SetupWizardStep2 {...defaultProps} />);
    const saveButton = screen.getByText("トークンを保存").closest("button")!;
    expect(saveButton).toBeDisabled();
  });

  it("enables save button when token is entered", async () => {
    const user = userEvent.setup();
    render(<SetupWizardStep2 {...defaultProps} />);
    await user.type(
      screen.getByPlaceholderText("ghp_xxxxxxxxxxxxxxxxxxxx"),
      "ghp_test123"
    );
    const saveButton = screen.getByText("トークンを保存").closest("button")!;
    expect(saveButton).not.toBeDisabled();
  });

  it("saves token and shows success message", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockResolvedValueOnce(undefined);
    render(<SetupWizardStep2 {...defaultProps} />);
    await user.type(
      screen.getByPlaceholderText("ghp_xxxxxxxxxxxxxxxxxxxx"),
      "ghp_test123"
    );
    await user.click(screen.getByText("トークンを保存"));
    await waitFor(() => {
      expect(screen.getByText("トークンを保存しました")).toBeInTheDocument();
    });
    expect(mockInvokeFn).toHaveBeenCalledWith("save_github_token", {
      token: "ghp_test123",
    });
  });

  it("shows error message when save fails", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockRejectedValueOnce(new Error("Network error"));
    render(<SetupWizardStep2 {...defaultProps} />);
    await user.type(
      screen.getByPlaceholderText("ghp_xxxxxxxxxxxxxxxxxxxx"),
      "ghp_test123"
    );
    await user.click(screen.getByText("トークンを保存"));
    await waitFor(() => {
      expect(
        screen.getByText(/トークンの保存に失敗しました:.*Network error/)
      ).toBeInTheDocument();
    });
  });

  it("shows next button after successful token save", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockResolvedValueOnce(undefined);
    render(<SetupWizardStep2 {...defaultProps} />);
    await user.type(
      screen.getByPlaceholderText("ghp_xxxxxxxxxxxxxxxxxxxx"),
      "ghp_test123"
    );
    await user.click(screen.getByText("トークンを保存"));
    await waitFor(() => {
      expect(screen.getByText("次へ")).toBeInTheDocument();
    });
  });

  it("calls onNext when next button is clicked after auth", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    mockInvokeFn.mockResolvedValueOnce(undefined);
    render(<SetupWizardStep2 {...defaultProps} onNext={onNext} />);
    await user.type(
      screen.getByPlaceholderText("ghp_xxxxxxxxxxxxxxxxxxxx"),
      "ghp_test123"
    );
    await user.click(screen.getByText("トークンを保存"));
    await waitFor(() => {
      expect(screen.getByText("次へ")).toBeInTheDocument();
    });
    await user.click(screen.getByText("次へ"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("toggles token visibility", async () => {
    const user = userEvent.setup();
    render(<SetupWizardStep2 {...defaultProps} />);
    const tokenInput = screen.getByPlaceholderText("ghp_xxxxxxxxxxxxxxxxxxxx");
    expect(tokenInput).toHaveAttribute("type", "password");
    await user.click(screen.getByText("表示"));
    expect(tokenInput).toHaveAttribute("type", "text");
    await user.click(screen.getByText("非表示"));
    expect(tokenInput).toHaveAttribute("type", "password");
  });

  it("shows device flow polling state after starting", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === "start_github_device_flow") {
        return Promise.resolve({
          device_code: "dc_123",
          user_code: "ABCD-1234",
          verification_uri: "https://github.com/login/device",
          interval: 5,
          expires_in: 900,
        });
      }
      // poll_github_device_flow - keep pending to stay in polling state
      return new Promise(() => {});
    });
    render(<SetupWizardStep2 {...defaultProps} />);
    await user.click(screen.getByText("GitHubでログイン"));
    await waitFor(() => {
      expect(screen.getByText("ABCD-1234")).toBeInTheDocument();
    });
    expect(
      screen.getByText("以下のコードをGitHubで入力してください:")
    ).toBeInTheDocument();
    expect(screen.getByText("ブラウザで開く")).toBeInTheDocument();
    expect(screen.getByText("認証を待っています…")).toBeInTheDocument();
  });

  it("shows error when device flow start fails", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockRejectedValueOnce(new Error("API unavailable"));
    render(<SetupWizardStep2 {...defaultProps} />);
    await user.click(screen.getByText("GitHubでログイン"));
    await waitFor(() => {
      expect(
        screen.getByText(/認証に失敗しました:.*API unavailable/)
      ).toBeInTheDocument();
    });
  });

  it("hides manual token section after successful auth", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockResolvedValueOnce(undefined);
    render(<SetupWizardStep2 {...defaultProps} />);
    await user.type(
      screen.getByPlaceholderText("ghp_xxxxxxxxxxxxxxxxxxxx"),
      "ghp_test123"
    );
    await user.click(screen.getByText("トークンを保存"));
    await waitFor(() => {
      expect(screen.getByText("トークンを保存しました")).toBeInTheDocument();
    });
    // Manual token section should be hidden after auth
    expect(
      screen.queryByText("または、Personal Access Tokenを手動入力")
    ).not.toBeInTheDocument();
  });

  it("shows skip note when not authenticated", () => {
    render(<SetupWizardStep2 {...defaultProps} />);
    expect(
      screen.getByText(
        "スキップしても、あとから設定画面でGitHub認証を行えます。"
      )
    ).toBeInTheDocument();
  });

  it("does not save when token is whitespace only", async () => {
    const user = userEvent.setup();
    render(<SetupWizardStep2 {...defaultProps} />);
    await user.type(
      screen.getByPlaceholderText("ghp_xxxxxxxxxxxxxxxxxxxx"),
      "   "
    );
    const saveButton = screen.getByText("トークンを保存").closest("button")!;
    expect(saveButton).toBeDisabled();
  });
});
