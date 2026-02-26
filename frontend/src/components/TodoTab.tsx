import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import { useRepository } from "../RepositoryContext";
import type { TodoItem, TodoKind } from "../types";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { Loading } from "./Loading";

type FilterKind = "all" | "Todo" | "Fixme";

function generateBranchName(filePath: string, lineNumber: number): string {
  const fileName = filePath.split("/").pop() ?? "unknown";
  const stem = fileName.replace(/\.[^.]+$/, "");
  return `todo/${stem}-${lineNumber}`;
}

export function TodoTab() {
  const { t } = useTranslation();
  const { repoPath } = useRepository();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadTodos = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke("extract_todos", { repoPath });
      setTodos(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    setTodos([]);
    setError(null);
  }, [repoPath]);

  const filtered = useMemo(() => {
    if (filter === "all") return todos;
    return todos.filter((item) => item.kind === filter);
  }, [todos, filter]);

  function kindVariant(kind: TodoKind): "warning" | "danger" {
    return kind === "Todo" ? "warning" : "danger";
  }

  const handleCreateWorktree = useCallback(
    async (item: TodoItem) => {
      if (!repoPath) return;
      const branch = generateBranchName(item.file_path, item.line_number);
      const confirmed = window.confirm(
        t("todo.createWorktreeConfirm", { branch })
      );
      if (!confirmed) return;

      const key = `${item.file_path}:${item.line_number}`;
      setCreatingKey(key);
      setError(null);
      setSuccessMessage(null);
      try {
        const result = await invoke("create_worktree_for_todo", {
          repoPath,
          filePath: item.file_path,
          lineNumber: item.line_number,
        });
        setSuccessMessage(
          t("todo.createWorktreeSuccess", {
            branch: result.branch ?? branch,
          })
        );
      } catch (err) {
        setError(t("todo.createWorktreeError", { message: String(err) }));
      } finally {
        setCreatingKey(null);
      }
    },
    [repoPath, t]
  );

  return (
    <div>
      <Card className="flex flex-col">
        <h2 className="mb-4 border-b border-border pb-2 text-lg text-text-heading">
          {t("todo.title")}
          {todos.length > 0 && (
            <span className="ml-2 text-sm text-text-secondary">
              {t("todo.count", { count: filtered.length })}
            </span>
          )}
        </h2>

        {todos.length > 0 && (
          <div className="mb-3 flex gap-2">
            {(["all", "Todo", "Fixme"] as const).map((f) => (
              <button
                key={f}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-accent text-bg-primary"
                    : "bg-bg-hover text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setFilter(f)}
              >
                {f === "all"
                  ? t("todo.filterAll")
                  : f === "Todo"
                    ? t("todo.filterTodo")
                    : t("todo.filterFixme")}
              </button>
            ))}
          </div>
        )}

        <div className="scrollbar-custom mb-4 min-h-[120px] max-h-[500px] flex-1 overflow-y-auto">
          {loading && <Loading />}
          {error && (
            <p className="p-2 text-[0.9rem] text-danger">
              {t("common.error", { message: error })}
            </p>
          )}
          {successMessage && (
            <p className="p-2 text-[0.9rem] text-accent">{successMessage}</p>
          )}
          {!loading && !error && todos.length === 0 && (
            <p className="p-2 text-[0.9rem] italic text-text-secondary">
              {t("todo.empty")}
            </p>
          )}
          {filtered.map((item, index) => {
            const itemKey = `${item.file_path}:${item.line_number}`;
            const isCreating = creatingKey === itemKey;
            return (
              <div
                key={itemKey}
                className={`border-b border-border px-3 py-2.5 font-mono text-[0.85rem] transition-colors last:border-b-0 hover:bg-bg-primary ${
                  index % 2 === 0 ? "" : "bg-bg-hover/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Badge variant={kindVariant(item.kind)}>
                    {item.kind === "Todo" ? "TODO" : "FIXME"}
                  </Badge>
                  <span className="flex-1 text-text-secondary">
                    {item.file_path}:{item.line_number}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isCreating}
                    onClick={() => handleCreateWorktree(item)}
                  >
                    {isCreating
                      ? t("todo.creatingWorktree")
                      : t("todo.createWorktree")}
                  </Button>
                </div>
                <div className="mt-1 pl-1 text-text-primary">
                  {item.content}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-4">
          <Button className="w-full" onClick={loadTodos} disabled={loading}>
            {loading ? t("todo.loading") : t("todo.loadButton")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
