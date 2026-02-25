import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorktreeTab } from "./WorktreeTab";
import { RepositoryProvider } from "../RepositoryContext";
import { fixtures } from "../storybook/fixtures";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "worktree.title": "Worktrees",
        "worktree.empty": "ワークツリーがありません",
        "worktree.locked": "locked",
        "worktree.detached": "detached",
        "worktree.createNew": "新しいワークツリーを作成",
        "worktree.path": "パス",
        "worktree.branchName": "ブランチ名",
        "worktree.created": "ワークツリーを作成しました",
        "common.loading": "Loading…",
        "common.create": "作成",
      };
      if (key === "worktree.branchLabel" && params) {
        return `ブランチ: ${params.name}`;
      }
      if (key === "worktree.pathLabel" && params) {
        return `パス: ${params.path}`;
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
  prs: fixtures.pullRequests,
  onNavigateToPr: vi.fn(),
};

describe("WorktreeTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === "list_worktrees") {
        return Promise.resolve(fixtures.worktrees);
      }
      return Promise.reject(new Error(`Unhandled command: ${command}`));
    });
  });

  it("shows loading state initially", () => {
    mockInvokeFn.mockImplementation(() => new Promise(() => {}));
    renderWithProvider(<WorktreeTab {...defaultProps} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("displays worktree list after loading", async () => {
    renderWithProvider(<WorktreeTab {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });
    expect(screen.getByText("feature-auth")).toBeInTheDocument();
    expect(screen.getByText("hotfix-login")).toBeInTheDocument();
  });

  it("shows locked badge for locked worktree", async () => {
    renderWithProvider(<WorktreeTab {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("locked")).toBeInTheDocument();
    });
  });

  it("shows detached badge for worktree without branch", async () => {
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === "list_worktrees") {
        return Promise.resolve([
          {
            name: "detached-wt",
            path: "/tmp/wt",
            branch: null,
            is_main: false,
            is_locked: false,
          },
        ]);
      }
      return Promise.reject(new Error(`Unhandled command: ${command}`));
    });
    renderWithProvider(<WorktreeTab {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("detached")).toBeInTheDocument();
    });
  });

  it("shows error state", async () => {
    mockInvokeFn.mockImplementation(() =>
      Promise.reject(new Error("connection failed"))
    );
    renderWithProvider(<WorktreeTab {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText(/エラー:.*connection failed/)
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when no worktrees", async () => {
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === "list_worktrees") return Promise.resolve([]);
      return Promise.reject(new Error(`Unhandled command: ${command}`));
    });
    renderWithProvider(<WorktreeTab {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText("ワークツリーがありません")
      ).toBeInTheDocument();
    });
  });

  it("shows PR badge linked to branch", async () => {
    renderWithProvider(<WorktreeTab {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("#42 open")).toBeInTheDocument();
    });
  });

  it("calls onNavigateToPr when PR badge is clicked", async () => {
    const user = userEvent.setup();
    const onNavigateToPr = vi.fn();
    renderWithProvider(
      <WorktreeTab prs={fixtures.pullRequests} onNavigateToPr={onNavigateToPr} />
    );
    await waitFor(() => {
      expect(screen.getByText("#42 open")).toBeInTheDocument();
    });
    await user.click(screen.getByText("#42 open"));
    expect(onNavigateToPr).toHaveBeenCalledWith(42);
  });

  it("renders create worktree form", async () => {
    renderWithProvider(<WorktreeTab {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("新しいワークツリーを作成")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("/path/to/worktree")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("feature-branch")).toBeInTheDocument();
    expect(screen.getByText("作成")).toBeInTheDocument();
  });
});
