import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import { useRepository } from "../RepositoryContext";
import type { TodoItem, TodoKind } from "../types";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Loading } from "./Loading";
import { WorktreeList } from "./WorktreeList";

type FilterKind = "all" | "Todo" | "Fixme";

function generateBranchName(filePath: string, lineNumber: number): string {
  const fileName = filePath.split("/").pop() ?? "unknown";
  const stem = fileName.replace(/\.[^.]+$/, "");
  return `todo/${stem}-${lineNumber}`;
}

/** ファイルパスからモジュールグループ名を導出する */
function getModuleGroup(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length <= 2) return parts[0];
  return parts.slice(0, 2).join("/");
}

interface TodoGroup {
  module: string;
  items: TodoItem[];
}

/** FIXME優先でソートし、同種内はファイルパス→行番号でソート */
function sortTodos(items: TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => {
    // FIXME first
    if (a.kind !== b.kind) return a.kind === "Fixme" ? -1 : 1;
    // Then by file path
    const pathCmp = a.file_path.localeCompare(b.file_path);
    if (pathCmp !== 0) return pathCmp;
    // Then by line number
    return a.line_number - b.line_number;
  });
}

/** アイテムをモジュールグループに分類する */
function groupByModule(items: TodoItem[]): TodoGroup[] {
  const groupMap = new Map<string, TodoItem[]>();
  for (const item of items) {
    const module = getModuleGroup(item.file_path);
    const group = groupMap.get(module);
    if (group) {
      group.push(item);
    } else {
      groupMap.set(module, [item]);
    }
  }

  // FIXMEを含むグループを優先、グループ内もFIXME優先ソート
  const groups: TodoGroup[] = Array.from(groupMap.entries()).map(
    ([module, groupItems]) => ({
      module,
      items: sortTodos(groupItems),
    })
  );

  groups.sort((a, b) => {
    const aHasFixme = a.items.some((i) => i.kind === "Fixme");
    const bHasFixme = b.items.some((i) => i.kind === "Fixme");
    if (aHasFixme !== bHasFixme) return aHasFixme ? -1 : 1;
    return a.module.localeCompare(b.module);
  });

  return groups;
}

interface TodoTabProps {
  onNavigateToBranch?: (branch: string) => void;
}

export function TodoTab({ onNavigateToBranch }: TodoTabProps) {
  const { t } = useTranslation();
  const { repoPath } = useRepository();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

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

  const groups = useMemo(() => groupByModule(filtered), [filtered]);

  const allGroupsCollapsed = useMemo(
    () =>
      groups.length > 0 && groups.every((g) => collapsedGroups.has(g.module)),
    [groups, collapsedGroups]
  );

  function kindVariant(kind: TodoKind): "warning" | "danger" {
    return kind === "Todo" ? "warning" : "danger";
  }

  const toggleGroup = useCallback((module: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  }, []);

  const toggleAllGroups = useCallback(() => {
    if (allGroupsCollapsed) {
      setCollapsedGroups(new Set());
    } else {
      setCollapsedGroups(new Set(groups.map((g) => g.module)));
    }
  }, [allGroupsCollapsed, groups]);

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
    <div className="space-y-6">
      <WorktreeList onNavigateToBranch={onNavigateToBranch} />
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
          <div className="mb-3 flex items-center gap-2">
            {(["all", "Todo", "Fixme"] as const).map((f) => (
              <Button
                key={f}
                variant="filter"
                size="sm"
                active={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === "all"
                  ? t("todo.filterAll")
                  : f === "Todo"
                    ? t("todo.filterTodo")
                    : t("todo.filterFixme")}
              </Button>
            ))}
            <div className="ml-auto">
              <button
                className="rounded px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
                onClick={toggleAllGroups}
              >
                {allGroupsCollapsed
                  ? t("todo.expandAll")
                  : t("todo.collapseAll")}
              </button>
            </div>
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
            <EmptyState message={t("todo.empty")} />
          )}
          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.module);
            return (
              <div key={group.module} className="mb-1">
                <button
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold text-text-heading hover:bg-bg-hover transition-colors"
                  onClick={() => toggleGroup(group.module)}
                  aria-expanded={!isCollapsed}
                >
                  <span
                    className={`inline-block text-[0.7rem] text-text-secondary transition-transform ${
                      isCollapsed ? "" : "rotate-90"
                    }`}
                  >
                    ▶
                  </span>
                  <span className="font-mono">{group.module}</span>
                  <span className="text-xs font-normal text-text-secondary">
                    {t("todo.groupCount", { count: group.items.length })}
                  </span>
                </button>
                {!isCollapsed && (
                  <div>
                    {group.items.map((item, index) => {
                      const itemKey = `${item.file_path}:${item.line_number}`;
                      const isCreating = creatingKey === itemKey;
                      return (
                        <div
                          key={itemKey}
                          className={`border-b border-border px-3 py-2.5 pl-8 font-mono text-[0.85rem] transition-colors last:border-b-0 hover:bg-bg-primary ${
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
                )}
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
