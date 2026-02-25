import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiffTab } from "./DiffTab";
import { RepositoryProvider } from "../RepositoryContext";
import { fixtures } from "../storybook/fixtures";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "diff.changedFiles": "変更されたファイル",
        "diff.loadPrompt": "差分を読み込んでください",
        "diff.selectFile": "ファイルを選択してください",
        "diff.noDiffContent": "差分内容がありません",
        "diff.loadButton": "読み込み",
      };
      if (key === "common.error" && params) {
        return `エラー: ${params.message}`;
      }
      return translations[key] ?? key;
    },
  }),
}));

const mockInvokeFn = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvokeFn(...args),
}));

function renderWithProvider(ui: React.ReactElement) {
  return render(
    <RepositoryProvider repoPath="/Users/dev/project" repoInfo={fixtures.repoInfo}>
      {ui}
    </RepositoryProvider>
  );
}

describe("DiffTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === "diff_workdir") {
        return Promise.resolve(fixtures.fileDiffs);
      }
      return Promise.reject(new Error(`Unhandled command: ${command}`));
    });
  });

  it("renders initial state with load prompt", () => {
    renderWithProvider(<DiffTab />);
    expect(
      screen.getByText("差分を読み込んでください")
    ).toBeInTheDocument();
    expect(screen.getByText("読み込み")).toBeInTheDocument();
  });

  it("shows file select prompt", () => {
    renderWithProvider(<DiffTab />);
    expect(
      screen.getByText("ファイルを選択してください")
    ).toBeInTheDocument();
  });

  it("loads and displays diffs when load button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProvider(<DiffTab />);
    await user.click(screen.getByText("読み込み"));
    await waitFor(() => {
      // src/auth.ts appears in both file list and header (auto-selected)
      expect(screen.getAllByText("src/auth.ts").length).toBeGreaterThanOrEqual(1);
    });
    expect(
      screen.getByText("src/components/LoginForm.tsx")
    ).toBeInTheDocument();
  });

  it("shows status badges for diff files", async () => {
    const user = userEvent.setup();
    renderWithProvider(<DiffTab />);
    await user.click(screen.getByText("読み込み"));
    await waitFor(() => {
      expect(screen.getByText("M")).toBeInTheDocument();
    });
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("shows diff content for selected file", async () => {
    const user = userEvent.setup();
    renderWithProvider(<DiffTab />);
    await user.click(screen.getByText("読み込み"));
    await waitFor(() => {
      expect(screen.getAllByText("src/auth.ts").length).toBeGreaterThanOrEqual(1);
    });
    // First file is auto-selected, check diff content
    expect(
      screen.getByText("@@ -10,6 +10,12 @@ export function authenticate()")
    ).toBeInTheDocument();
  });

  it("shows error state when load fails", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockImplementation(() =>
      Promise.reject(new Error("diff failed"))
    );
    renderWithProvider(<DiffTab />);
    await user.click(screen.getByText("読み込み"));
    await waitFor(() => {
      expect(
        screen.getByText(/エラー:.*diff failed/)
      ).toBeInTheDocument();
    });
  });

  it("shows no diff content message for empty chunks", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === "diff_workdir") {
        return Promise.resolve([
          {
            old_path: "src/empty.ts",
            new_path: "src/empty.ts",
            status: "Modified",
            chunks: [],
          },
        ]);
      }
      return Promise.reject(new Error(`Unhandled command: ${command}`));
    });
    renderWithProvider(<DiffTab />);
    await user.click(screen.getByText("読み込み"));
    await waitFor(() => {
      // src/empty.ts appears in both file list and header (auto-selected)
      expect(screen.getAllByText("src/empty.ts").length).toBeGreaterThanOrEqual(1);
    });
    expect(
      screen.getByText("差分内容がありません")
    ).toBeInTheDocument();
  });
});
