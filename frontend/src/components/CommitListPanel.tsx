import { useTranslation } from "react-i18next";
import type { CommitInfo } from "../types";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Loading } from "./Loading";

interface CommitListPanelProps {
  commits: CommitInfo[];
  loading?: boolean;
  error?: string | null;
}

function formatShortSha(sha: string): string {
  return sha.slice(0, 7);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CommitListPanel({
  commits,
  loading = false,
  error = null,
}: CommitListPanelProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <h2 className="mb-3 border-b border-border pb-2 text-lg text-text-heading">
        {t("pr.commits")}
      </h2>

      {loading && <Loading />}

      {error && (
        <p className="p-2 text-[0.9rem] text-danger">
          {t("pr.commitsError")}: {error}
        </p>
      )}

      {!loading && !error && commits.length === 0 && (
        <EmptyState message={t("pr.commitsEmpty")} />
      )}

      {!loading &&
        !error &&
        commits.map((commit) => (
          <div
            key={commit.sha}
            className="border-b border-border px-3 py-2.5 last:border-b-0"
          >
            <div className="flex items-center gap-2">
              <code className="shrink-0 rounded bg-bg-hover px-1.5 py-0.5 text-xs text-info">
                {formatShortSha(commit.sha)}
              </code>
              <span className="truncate text-sm font-medium text-text-primary">
                {commit.message}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 pl-[calc(1.5rem+0.75rem+0.5rem)] text-xs text-text-secondary">
              <span>{commit.author}</span>
              <span>{formatDate(commit.date)}</span>
            </div>
          </div>
        ))}
    </Card>
  );
}
