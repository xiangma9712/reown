import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BranchTab } from "./BranchTab";
import { RepositoryProvider } from "../RepositoryContext";
import { fixtures } from "../storybook/fixtures";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "branch.title": "Branches",
        "branch.empty": "ブランチがありません",
        "branch.createNew": "新しいブランチを作成",
        "branch.branchName": "ブランチ名",
        "branch.switch": "切り替え",
        "common.loading": "Loading…",
        "common.create": "作成",
        "common.delete": "削除",
      };
      if (key === "branch.upstream" && params) {
        return `upstream: ${params.name}`;
      }
      if (key === "branch.created" && params) {
        return `ブランチ ${params.name} を作成しました`;
      }
      if (key === "branch.switched" && params) {
        return `ブランチ ${params.name} に切り替えました`;
      }
      if (key === "branch.deleted" && params) {
        return `ブランチ ${params.name} を削除しました`;
      }
      if (key === "branch.confirmDelete" && params) {
        return `${params.name} を削除しますか？`;
      }
      if (key === "branch.actions" && params) {
        return `${params.name} のアクション`;
      }
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

const defaultProps = {
  showConfirm: vi.fn().mockResolvedValue(true),
  prs: fixtures.pullRequests,
  onNavigateToPr: vi.fn(),
};

describe("BranchTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.showConfirm = vi.fn().mockResolvedValue(true);
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === "list_branches") {
        return Promise.resolve(fixtures.branches);
      }
      if (command === "create_branch") {
        return Promise.resolve(undefined);
      }
      return Promise.reject(new Error(`Unhandled command: ${command}`));
    });
  });

  it("shows loading state initially", () => {
    mockInvokeFn.mockImplementation(() => new Promise(() => {}));
    renderWithProvider(<BranchTab {...defaultProps} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("displays branch list after loading", async () => {
    renderWithProvider(<BranchTab {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("* main")).toBeInTheDocument();
    });
    expect(screen.getByText("feature/auth")).toBeInTheDocument();
    expect(screen.getByText("feature/dashboard")).toBeInTheDocument();
  });

  it("shows upstream info", async () => {
    renderWithProvider(<BranchTab {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText("upstream: origin/main")
      ).toBeInTheDocument();
    });
  });

  it("shows error state", async () => {
    mockInvokeFn.mockImplementation(() =>
      Promise.reject(new Error("fetch failed"))
    );
    renderWithProvider(<BranchTab {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText(/エラー:.*fetch failed/)
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when no branches", async () => {
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === "list_branches") return Promise.resolve([]);
      return Promise.reject(new Error(`Unhandled command: ${command}`));
    });
    renderWithProvider(<BranchTab {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText("ブランチがありません")
      ).toBeInTheDocument();
    });
  });

  it("shows PR badge linked to branch", async () => {
    renderWithProvider(<BranchTab {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("#42 open")).toBeInTheDocument();
    });
  });

  it("renders create branch form", async () => {
    renderWithProvider(<BranchTab {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("新しいブランチを作成")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("new-branch")).toBeInTheDocument();
    expect(screen.getByText("作成")).toBeInTheDocument();
  });

  it("creates a new branch via form", async () => {
    const user = userEvent.setup();
    renderWithProvider(<BranchTab {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("* main")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("new-branch"), "feature/new");
    await user.click(screen.getByText("作成"));
    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith("create_branch", {
        repoPath: "/Users/dev/project",
        name: "feature/new",
      });
    });
  });

  it("does not show action menu for head branch", async () => {
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === "list_branches") {
        return Promise.resolve([
          { name: "main", is_head: true, upstream: null },
        ]);
      }
      return Promise.reject(new Error(`Unhandled command: ${command}`));
    });
    renderWithProvider(<BranchTab {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("* main")).toBeInTheDocument();
    });
    expect(
      screen.queryByLabelText("main のアクション")
    ).not.toBeInTheDocument();
  });
});
