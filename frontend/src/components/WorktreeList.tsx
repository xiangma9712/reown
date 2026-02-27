import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import { useRepository } from "../RepositoryContext";
import type { WorktreeInfo } from "../types";
import { Badge } from "./Badge";
import { Card } from "./Card";
import { Loading } from "./Loading";

interface WorktreeListProps {
  onNavigateToBranch?: (branch: string) => void;
}

export function WorktreeList({ onNavigateToBranch }: WorktreeListProps) {
  const { t } = useTranslation();
  const { repoPath } = useRepository();
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadWorktrees = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke("list_worktrees", { repoPath });
      setWorktrees(result);
      setLoaded(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    setWorktrees([]);
    setError(null);
    setLoaded(false);
  }, [repoPath]);

  useEffect(() => {
    if (repoPath) {
      loadWorktrees();
    }
  }, [repoPath, loadWorktrees]);

  const mainWorktrees = worktrees.filter((w) => w.is_main);
  const subWorktrees = worktrees.filter((w) => !w.is_main);

  return (
    <Card className="flex flex-col">
      <h2 className="mb-4 border-b border-border pb-2 text-lg text-text-heading">
        {t("worktree.title")}
        {worktrees.length > 0 && (
          <span className="ml-2 text-sm text-text-secondary">
            {t("worktree.count", { count: worktrees.length })}
          </span>
        )}
      </h2>

      <div className="scrollbar-custom min-h-[80px] max-h-[400px] flex-1 overflow-y-auto">
        {loading && <Loading />}
        {error && (
          <p className="p-2 text-[0.9rem] text-danger">
            {t("common.error", { message: error })}
          </p>
        )}
        {!loading && !error && loaded && worktrees.length === 0 && (
          <p className="p-2 text-[0.9rem] italic text-text-secondary">
            {t("worktree.empty")}
          </p>
        )}

        {mainWorktrees.map((wt) => (
          <WorktreeItem
            key={wt.path}
            worktree={wt}
            onNavigateToBranch={onNavigateToBranch}
          />
        ))}

        {subWorktrees.length > 0 && mainWorktrees.length > 0 && (
          <div className="my-2 border-t border-border" />
        )}

        {subWorktrees.map((wt) => (
          <WorktreeItem
            key={wt.path}
            worktree={wt}
            onNavigateToBranch={onNavigateToBranch}
          />
        ))}
      </div>
    </Card>
  );
}

function WorktreeItem({
  worktree,
  onNavigateToBranch,
}: {
  worktree: WorktreeInfo;
  onNavigateToBranch?: (branch: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-border px-3 py-2.5 font-mono text-[0.85rem] transition-colors last:border-b-0 hover:bg-bg-primary">
      <div className="flex items-center gap-2">
        {worktree.is_main ? (
          <Badge variant="info">{t("worktree.main")}</Badge>
        ) : (
          <Badge variant="default">{t("worktree.sub")}</Badge>
        )}
        {worktree.is_locked && (
          <Badge variant="warning">{t("worktree.locked")}</Badge>
        )}
        <span className="flex-1 truncate text-text-heading">
          {worktree.name}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 pl-1">
        {worktree.branch && (
          <span className="text-text-secondary">
            {onNavigateToBranch ? (
              <button
                className="text-accent hover:underline"
                onClick={() => onNavigateToBranch(worktree.branch!)}
              >
                {worktree.branch}
              </button>
            ) : (
              worktree.branch
            )}
          </span>
        )}
      </div>
      <div className="mt-0.5 truncate pl-1 text-xs text-text-secondary">
        {worktree.path}
      </div>
    </div>
  );
}
