import { useState, useEffect, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import type { WorktreeInfo } from "../types";

export function WorktreeTab() {
  const { t } = useTranslation();
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

  async function loadWorktrees() {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke("list_worktrees");
      setWorktrees(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorktrees();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!wtPath.trim() || !wtBranch.trim()) return;

    setSubmitting(true);
    setFormMessage(null);
    try {
      await invoke("add_worktree", {
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
      <section className="flex flex-col rounded-lg border border-border bg-bg-secondary p-5">
        <h2 className="mb-4 border-b border-border pb-2 text-lg text-white">
          {t("worktree.title")}
        </h2>
        <div className="scrollbar-custom mb-4 min-h-[120px] max-h-[360px] flex-1 overflow-y-auto">
          {loading && (
            <p className="p-2 text-[0.9rem] text-text-secondary">
              {t("common.loading")}
            </p>
          )}
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
                <span className="ml-2 inline-block rounded-sm bg-danger px-1.5 py-0.5 text-[0.7rem] text-white">
                  {t("worktree.locked")}
                </span>
              )}
              {!wt.branch && (
                <span className="ml-2 inline-block rounded-sm bg-status-modified-bg px-1.5 py-0.5 text-[0.7rem] text-warning">
                  {t("worktree.detached")}
                </span>
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
              <label
                htmlFor="wt-path"
                className="mb-0.5 block text-[0.8rem] text-text-secondary"
              >
                {t("worktree.path")}
              </label>
              <input
                type="text"
                id="wt-path"
                placeholder="/path/to/worktree"
                required
                value={wtPath}
                onChange={(e) => setWtPath(e.target.value)}
                className="w-full rounded border border-border-hover bg-bg-primary px-2.5 py-1.5 font-mono text-[0.85rem] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div className="mb-2.5">
              <label
                htmlFor="wt-branch"
                className="mb-0.5 block text-[0.8rem] text-text-secondary"
              >
                {t("worktree.branchName")}
              </label>
              <input
                type="text"
                id="wt-branch"
                placeholder="feature-branch"
                required
                value={wtBranch}
                onChange={(e) => setWtBranch(e.target.value)}
                className="w-full rounded border border-border-hover bg-bg-primary px-2.5 py-1.5 font-mono text-[0.85rem] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="cursor-pointer rounded border-none bg-accent px-3 py-1.5 text-[0.8rem] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submitting}
            >
              {t("common.create")}
            </button>
          </form>
          {formMessage && (
            <div
              className={`mt-2 min-h-[1.2em] text-[0.8rem] ${formMessage.type === "success" ? "text-accent" : "text-danger"}`}
            >
              {formMessage.text}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
