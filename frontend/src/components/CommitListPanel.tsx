import { useTranslation } from "react-i18next";
import type { CommitInfo } from "../types";
import { Badge } from "./Badge";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Loading } from "./Loading";
import type { ComponentProps } from "react";

interface CommitListPanelProps {
  commits: CommitInfo[];
  loading?: boolean;
  error?: string | null;
}

function formatShortSha(sha: string): string {
  return sha.slice(0, 7);
}

const prefixVariants: Record<string, ComponentProps<typeof Badge>["variant"]> =
  {
    feat: "success",
    fix: "danger",
    refactor: "accent",
    docs: "info",
    test: "warning",
    chore: "default",
    perf: "info",
    style: "default",
  };

function parsePrefix(message: string): {
  prefix: string | null;
  rest: string;
} {
  const match = message.match(/^(\w+):\s*/);
  if (match && match[1] in prefixVariants) {
    return { prefix: match[1], rest: message.slice(match[0].length) };
  }
  return { prefix: null, rest: message };
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
              {commit.commit_url ? (
                <a
                  href={commit.commit_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded bg-bg-hover px-1.5 py-0.5 font-mono text-xs text-info underline decoration-info/40 hover:decoration-info"
                >
                  {formatShortSha(commit.sha)}
                </a>
              ) : (
                <code className="shrink-0 rounded bg-bg-hover px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                  {formatShortSha(commit.sha)}
                </code>
              )}
              {(() => {
                const { prefix, rest } = parsePrefix(commit.message);
                return (
                  <span className="flex min-w-0 items-center gap-1.5">
                    {prefix && (
                      <Badge variant={prefixVariants[prefix]}>{prefix}</Badge>
                    )}
                    <span className="truncate text-sm text-text-primary">
                      {rest}
                    </span>
                  </span>
                );
              })()}
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
