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
        "todo.expandAll": "全て展開",
        "todo.collapseAll": "全て折りたたみ",
        "common.loading": "Loading…",
      };
      if (key === "todo.count" && params) {
        return `${params.count}件`;
      }
      if (key === "todo.groupCount" && params) {
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
    <RepositoryProvider
      repoPath="/Users/dev/project"
      repoInfo={fixtures.repoInfo}
    >
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
      if (command === "list_worktrees") {
        return Promise.resolve([]);
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
    expect(screen.getByText("TODOアイテムがありません")).toBeInTheDocument();
  });

  it("shows loading state while fetching", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === "list_worktrees") return Promise.resolve([]);
      return new Promise(() => {});
    });
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
    expect(screen.getByText("バリデーションエラーの表示")).toBeInTheDocument();
    expect(screen.getByText("このファイルは削除予定")).toBeInTheDocument();
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
      expect(
        screen.getByText("3件", { selector: "h2 span" })
      ).toBeInTheDocument();
    });
  });

  it("shows module group headers", async () => {
    const user = userEvent.setup();
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    await waitFor(() => {
      // fixture items: src/auth.ts -> "src", src/components/LoginForm.tsx -> "src/components", src/legacy/old-auth.ts -> "src/legacy"
      expect(screen.getByText("src/legacy")).toBeInTheDocument();
    });
    expect(screen.getByText("src/components")).toBeInTheDocument();
  });

  it("sorts FIXME items before TODO items", async () => {
    const user = userEvent.setup();
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    await waitFor(() => {
      expect(screen.getByText("このファイルは削除予定")).toBeInTheDocument();
    });
    // FIXME group (src/legacy) should appear before TODO-only groups
    const groupButtons = screen.getAllByRole("button", { expanded: true });
    const groupTexts = groupButtons.map((btn) => btn.textContent);
    const legacyIdx = groupTexts.findIndex((t) => t?.includes("src/legacy"));
    const authIdx = groupTexts.findIndex(
      (t) => t?.includes("src") && !t?.includes("src/")
    );
    expect(legacyIdx).toBeLessThan(authIdx);
  });

  it("collapses and expands groups", async () => {
    const user = userEvent.setup();
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    await waitFor(() => {
      expect(screen.getByText("このファイルは削除予定")).toBeInTheDocument();
    });
    // Click "全て折りたたみ"
    await user.click(screen.getByText("全て折りたたみ"));
    // Items should be hidden
    expect(
      screen.queryByText("このファイルは削除予定")
    ).not.toBeInTheDocument();
    // Click "全て展開"
    await user.click(screen.getByText("全て展開"));
    // Items should be visible again
    expect(screen.getByText("このファイルは削除予定")).toBeInTheDocument();
  });

  it("toggles individual group", async () => {
    const user = userEvent.setup();
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    await waitFor(() => {
      expect(screen.getByText("このファイルは削除予定")).toBeInTheDocument();
    });
    // Click the src/legacy group header to collapse it
    const legacyHeader = screen.getByText("src/legacy").closest("button")!;
    await user.click(legacyHeader);
    // FIXME item should be hidden
    expect(
      screen.queryByText("このファイルは削除予定")
    ).not.toBeInTheDocument();
    // Other items should still be visible
    expect(screen.getByText("リフレッシュトークンの実装")).toBeInTheDocument();
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
      expect(
        screen.getByText("2件", { selector: "h2 span" })
      ).toBeInTheDocument();
    });
    expect(screen.getByText("リフレッシュトークンの実装")).toBeInTheDocument();
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
      expect(
        screen.getByText("1件", { selector: "h2 span" })
      ).toBeInTheDocument();
    });
    expect(screen.getByText("このファイルは削除予定")).toBeInTheDocument();
    expect(
      screen.queryByText("リフレッシュトークンの実装")
    ).not.toBeInTheDocument();
  });

  it("shows error state when load fails", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === "list_worktrees") return Promise.resolve([]);
      return Promise.reject(new Error("extract failed"));
    });
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    await waitFor(() => {
      expect(screen.getByText(/エラー:.*extract failed/)).toBeInTheDocument();
    });
  });

  it("shows grouped items with groupedTodoItems fixture", async () => {
    const user = userEvent.setup();
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === "extract_todos") {
        return Promise.resolve(fixtures.groupedTodoItems);
      }
      return Promise.reject(new Error(`Unhandled command: ${command}`));
    });
    renderWithProvider(<TodoTab />);
    await user.click(screen.getByText("TODOを抽出"));
    await waitFor(() => {
      expect(screen.getByText("lib/git")).toBeInTheDocument();
    });
    expect(screen.getByText("lib/github")).toBeInTheDocument();
    expect(screen.getByText("frontend/src")).toBeInTheDocument();
    expect(screen.getByText("app/src")).toBeInTheDocument();
  });
});
