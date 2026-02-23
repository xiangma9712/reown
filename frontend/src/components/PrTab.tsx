import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import type { PrInfo } from "../types";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { Loading } from "./Loading";

function stateVariant(
  state: string,
): "success" | "danger" | "purple" | "default" {
  switch (state) {
    case "open":
      return "success";
    case "closed":
      return "danger";
    case "merged":
      return "purple";
    default:
      return "default";
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
              <Input
                id="pr-owner"
                label={t("pr.owner")}
                placeholder="owner"
                required
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
            <div className="mb-0 flex-1">
              <Input
                id="pr-repo"
                label={t("pr.repo")}
                placeholder="repo"
                required
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
            </div>
            <div className="mb-0 flex-1">
              <Input
                type="password"
                id="pr-token"
                label={t("pr.token")}
                placeholder="ghp_..."
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <Button
              className="shrink-0 self-end"
              onClick={() => handleLoad()}
              disabled={loading}
            >
              {t("pr.fetch")}
            </Button>
          </div>
          {formError && (
            <div className="mt-2 min-h-[1.2em] text-[0.8rem] text-danger">
              {formError}
            </div>
          )}
        </div>
        <div className="scrollbar-custom overflow-y-auto">
          {loading && <Loading />}
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
                <Badge variant={stateVariant(pr.state)}>{pr.state}</Badge>
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
