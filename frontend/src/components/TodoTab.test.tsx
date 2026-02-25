import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TodoTab } from "./TodoTab";
import { RepositoryProvider } from "../RepositoryContext";
import { fixtures } from "../storybook/fixtures";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "todo.title": "TODO / FIXME",
        "todo.empty": "TODOアイテムがありません",
        "todo.loadButton": "TODOを抽出",
        "todo.loading": "抽出中…",
        "todo.filterAll": "すべて",
        "todo.filterTodo": "TODO",
        "todo.filterFixme": "FIXME",
        "common.loading": "Loading…",
      };
      if (key === "todo.count" && params) {
        return `${params.count}件`;
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

describe("TodoTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === "extract_todos") {
        return Promise.resolve(fixtures.todoItems);
      }
      return Promise.reject(new Error(`Unhandled command: ${command}`));
    });
  });

  it("renders initial state with load button", () => {
    renderWithProvider(<TodoTab />);
    expect(screen.getByText("TODO / FIXME")).toBeInTheDocument();
    expect(screen.getByText("TODOを抽出")).toBeInTheDocument();
  });

  it("shows empty state before loading", () => {
    renderWithProvider(<TodoTab />);
    expect(
      screen.getByText("TODOアイテムがありません")
    ).toBeInTheDocument();
  });

  it("shows loading state while fetching", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockImplementation(() => new Promise(() => {}));
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("displays todo items after loading", async () => {
    const user = userEvent.setup();
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    await waitFor(() => {
      expect(
        screen.getByText("リフレッシュトークンの実装")
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("バリデーションエラーの表示")
    ).toBeInTheDocument();
    expect(
      screen.getByText("このファイルは削除予定")
    ).toBeInTheDocument();
  });

  it("shows file path and line number", async () => {
    const user = userEvent.setup();
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    await waitFor(() => {
      expect(screen.getByText("src/auth.ts:25")).toBeInTheDocument();
    });
  });

  it("shows TODO and FIXME badges", async () => {
    const user = userEvent.setup();
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    await waitFor(() => {
      // 2 TODO badges + 1 TODO filter button = 3
      expect(screen.getAllByText("TODO")).toHaveLength(3);
    });
    // 1 FIXME badge + 1 FIXME filter button = 2
    expect(screen.getAllByText("FIXME")).toHaveLength(2);
  });

  it("shows count after loading", async () => {
    const user = userEvent.setup();
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    await waitFor(() => {
      expect(screen.getByText("3件")).toBeInTheDocument();
    });
  });

  it("filters by TODO", async () => {
    const user = userEvent.setup();
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    await waitFor(() => {
      expect(
        screen.getByText("リフレッシュトークンの実装")
      ).toBeInTheDocument();
    });
    // Click the filter button (not the badge)
    const filterButtons = screen.getAllByRole("button");
    const todoFilterBtn = filterButtons.find(
      (btn) => btn.textContent === "TODO" && btn.classList.contains("rounded")
    );
    expect(todoFilterBtn).toBeDefined();
    await user.click(todoFilterBtn!);
    await waitFor(() => {
      expect(screen.getByText("2件")).toBeInTheDocument();
    });
    expect(
      screen.getByText("リフレッシュトークンの実装")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("このファイルは削除予定")
    ).not.toBeInTheDocument();
  });

  it("filters by FIXME", async () => {
    const user = userEvent.setup();
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    await waitFor(() => {
      expect(
        screen.getByText("リフレッシュトークンの実装")
      ).toBeInTheDocument();
    });
    const filterButtons = screen.getAllByRole("button");
    const fixmeFilterBtn = filterButtons.find(
      (btn) => btn.textContent === "FIXME" && btn.classList.contains("rounded")
    );
    expect(fixmeFilterBtn).toBeDefined();
    await user.click(fixmeFilterBtn!);
    await waitFor(() => {
      expect(screen.getByText("1件")).toBeInTheDocument();
    });
    expect(
      screen.getByText("このファイルは削除予定")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("リフレッシュトークンの実装")
    ).not.toBeInTheDocument();
  });

  it("shows error state when load fails", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockImplementation(() =>
      Promise.reject(new Error("extract failed"))
    );
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    await waitFor(() => {
      expect(
        screen.getByText(/エラー:.*extract failed/)
      ).toBeInTheDocument();
    });
  });
});
