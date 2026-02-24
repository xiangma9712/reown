import { useState, useEffect, useCallback, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import { useRepository } from "../RepositoryContext";
import type { WorktreeInfo } from "../types";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { Input } from "./Input";
import { Loading } from "./Loading";

export function WorktreeTab() {
  const { t } = useTranslation();
  const { repoPath } = useRepository();
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const [wtPath, setWtPath] = useState("");
  const [wtBranch, setWtBranch] = useState("");
  const [formMessage, setFormMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadWorktrees = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke("list_worktrees", { repoPath });
      setWorktrees(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    loadWorktrees();
  }, [loadWorktrees]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!repoPath || !wtPath.trim() || !wtBranch.trim()) return;

    setSubmitting(true);
    setFormMessage(null);
    try {
      await invoke("add_worktree", {
        repoPath,
        worktreePath: wtPath.trim(),
        branch: wtBranch.trim(),
      });
      setFormMessage({ text: t("worktree.created"), type: "success" });
      setWtPath("");
      setWtBranch("");
      await loadWorktrees();
    } catch (err) {
      setFormMessage({
        text: t("common.error", { message: err }),
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Card className="flex flex-col">
        <h2 className="mb-4 border-b border-border pb-2 text-lg text-text-heading">
          {t("worktree.title")}
        </h2>
        <div className="scrollbar-custom mb-4 min-h-[120px] max-h-[360px] flex-1 overflow-y-auto">
          {loading && <Loading />}
          {error && (
            <p className="p-2 text-[0.9rem] text-danger">
              {t("common.error", { message: error })}
            </p>
          )}
          {!loading && !error && worktrees.length === 0 && (
            <p className="p-2 text-[0.9rem] italic text-text-secondary">
              {t("worktree.empty")}
            </p>
          )}
          {worktrees.map((wt, index) => (
            <div
              key={wt.path}
              className={`cursor-pointer border-b border-border px-3 py-2.5 font-mono text-[0.85rem] transition-colors last:border-b-0 hover:bg-bg-primary ${
                selectedIndex === index
                  ? "border-l-2 border-l-accent bg-bg-hover"
                  : ""
              }`}
              onClick={() => setSelectedIndex(index)}
            >
              <span
                className={`font-bold ${wt.is_main ? "text-accent" : "text-text-primary"}`}
              >
                {wt.name}
              </span>
              {wt.is_locked && (
                <Badge variant="danger" className="ml-2">
                  {t("worktree.locked")}
                </Badge>
              )}
              {!wt.branch && (
                <Badge variant="warning" className="ml-2">
                  {t("worktree.detached")}
                </Badge>
              )}
              <div className="mt-0.5 text-[0.8rem] text-text-secondary">
                {t("worktree.branchLabel", {
                  name: wt.branch ?? "(detached)",
                })}
              </div>
              <div className="mt-0.5 text-[0.8rem] text-text-secondary">
                {t("worktree.pathLabel", { path: wt.path })}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-4">
          <h3 className="mb-3 text-[0.9rem] text-text-primary/80">
            {t("worktree.createNew")}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-2.5">
              <Input
                id="wt-path"
                label={t("worktree.path")}
                placeholder="/path/to/worktree"
                required
                value={wtPath}
                onChange={(e) => setWtPath(e.target.value)}
              />
            </div>
            <div className="mb-2.5">
              <Input
                id="wt-branch"
                label={t("worktree.branchName")}
                placeholder="feature-branch"
                required
                value={wtBranch}
                onChange={(e) => setWtBranch(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {t("common.create")}
            </Button>
          </form>
          {formMessage && (
            <div
              className={`mt-2 min-h-[1.2em] text-[0.8rem] ${formMessage.type === "success" ? "text-accent" : "text-danger"}`}
            >
              {formMessage.text}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
