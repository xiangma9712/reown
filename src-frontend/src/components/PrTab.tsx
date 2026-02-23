import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import type { PrInfo } from "../types";

function stateClass(state: string): string {
  switch (state) {
    case "open":
      return "bg-status-added-bg text-accent";
    case "closed":
      return "bg-status-deleted-bg text-danger";
    case "merged":
      return "bg-pr-merged-bg text-purple";
    default:
      return "bg-btn-secondary text-text-secondary";
  }
}

export function PrTab() {
  const { t } = useTranslation();
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [prs, setPrs] = useState<PrInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleLoad(e?: FormEvent) {
    e?.preventDefault();
    if (!owner.trim() || !repo.trim() || !token.trim()) {
      setFormError(t("pr.fillAllFields"));
      return;
    }

    setFormError(null);
    setError(null);
    setLoading(true);
    try {
      const result = await invoke("list_pull_requests", {
        owner: owner.trim(),
        repo: repo.trim(),
        token: token.trim(),
      });
      setPrs(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <section className="flex flex-col rounded-lg border border-border bg-bg-secondary p-5">
        <h2 className="mb-4 border-b border-border pb-2 text-lg text-white">
          {t("pr.title")}
        </h2>
        <div>
          <div className="mb-2 flex items-end gap-3">
            <div className="mb-0 flex-1">
              <label
                htmlFor="pr-owner"
                className="mb-0.5 block text-[0.8rem] text-text-secondary"
              >
                {t("pr.owner")}
              </label>
              <input
                type="text"
                id="pr-owner"
                placeholder="owner"
                required
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full rounded border border-border-hover bg-bg-primary px-2.5 py-1.5 font-mono text-[0.85rem] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div className="mb-0 flex-1">
              <label
                htmlFor="pr-repo"
                className="mb-0.5 block text-[0.8rem] text-text-secondary"
              >
                {t("pr.repo")}
              </label>
              <input
                type="text"
                id="pr-repo"
                placeholder="repo"
                required
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                className="w-full rounded border border-border-hover bg-bg-primary px-2.5 py-1.5 font-mono text-[0.85rem] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div className="mb-0 flex-1">
              <label
                htmlFor="pr-token"
                className="mb-0.5 block text-[0.8rem] text-text-secondary"
              >
                {t("pr.token")}
              </label>
              <input
                type="password"
                id="pr-token"
                placeholder="ghp_..."
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full rounded border border-border-hover bg-bg-primary px-2.5 py-1.5 font-mono text-[0.85rem] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <button
              className="shrink-0 cursor-pointer self-end rounded border-none bg-accent px-3 py-1.5 text-[0.8rem] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handleLoad()}
              disabled={loading}
            >
              {t("pr.fetch")}
            </button>
          </div>
          {formError && (
            <div className="mt-2 min-h-[1.2em] text-[0.8rem] text-danger">
              {formError}
            </div>
          )}
        </div>
        <div className="scrollbar-custom overflow-y-auto">
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
          {!loading && !error && prs.length === 0 && (
            <p className="p-2 text-[0.9rem] italic text-text-secondary">
              {t("pr.empty")}
            </p>
          )}
          {prs.map((pr) => (
            <div
              key={pr.number}
              className="border-b border-border px-3 py-3 last:border-b-0"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-[0.8rem] font-semibold text-info">
                  #{pr.number}
                </span>
                <span className="text-[0.9rem] font-medium text-text-primary">
                  {pr.title}
                </span>
                <span
                  className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[0.7rem] font-semibold ${stateClass(pr.state)}`}
                >
                  {pr.state}
                </span>
              </div>
              <div className="mt-0.5 flex gap-4 text-xs text-text-secondary">
                <span>@{pr.author}</span>
                <span>{pr.head_branch}</span>
                <span className="font-mono text-accent">+{pr.additions}</span>
                <span className="font-mono text-danger">-{pr.deletions}</span>
                <span className="font-mono">
                  {t("pr.files", { count: pr.changed_files })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
