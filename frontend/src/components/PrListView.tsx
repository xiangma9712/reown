import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { PrInfo, CommitInfo, RiskLevel } from "../types";
import { invoke } from "../invoke";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { CommitListPanel } from "./CommitListPanel";
import { EmptyState } from "./EmptyState";
import { Loading } from "./Loading";
import { RiskBadge } from "./RiskBadge";

type FilterState = "all" | "open" | "closed" | "merged";

interface PrListViewProps {
  prs: PrInfo[];
  loading?: boolean;
  error?: string | null;
  riskLevels?: Record<number, RiskLevel>;
  owner?: string;
  repo?: string;
  onSelectPr?: (pr: PrInfo) => void;
}

function stateVariant(
  state: string
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

function PrStateIcon({ state }: { state: string }) {
  const props = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "shrink-0",
  };

  switch (state) {
    case "open":
      return (
        <svg {...props}>
          <circle cx="12" cy="6" r="3" />
          <circle cx="12" cy="18" r="3" />
          <line x1="12" y1="9" x2="12" y2="15" />
        </svg>
      );
    case "closed":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case "merged":
      return (
        <svg {...props}>
          <circle cx="18" cy="18" r="3" />
          <circle cx="6" cy="6" r="3" />
          <path d="M6 9v12" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
      );
    default:
      return null;
  }
}

export function PrListView({
  prs,
  loading = false,
  error = null,
  riskLevels = {},
  owner,
  repo,
  onSelectPr,
}: PrListViewProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterState>("all");
  const [expandedPr, setExpandedPr] = useState<number | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState<string | null>(null);

  const filteredPrs =
    filter === "all" ? prs : prs.filter((pr) => pr.state === filter);

  const filters: { key: FilterState; label: string }[] = [
    { key: "all", label: t("pr.filterAll") },
    { key: "open", label: t("pr.filterOpen") },
    { key: "closed", label: t("pr.filterClosed") },
    { key: "merged", label: t("pr.filterMerged") },
  ];

  const handlePrClick = useCallback(
    async (pr: PrInfo) => {
      onSelectPr?.(pr);

      if (expandedPr === pr.number) {
        setExpandedPr(null);
        return;
      }

      setExpandedPr(pr.number);

      if (!owner || !repo) return;

      setCommitsLoading(true);
      setCommitsError(null);
      setCommits([]);
      try {
        const result = await invoke("list_pr_commits", {
          owner,
          repo,
          prNumber: pr.number,
        });
        setCommits(result);
      } catch (err) {
        setCommitsError(String(err));
      } finally {
        setCommitsLoading(false);
      }
    },
    [owner, repo, expandedPr, onSelectPr]
  );

  return (
    <Card>
      <h2 className="mb-3 border-b border-border pb-2 text-lg text-text-heading">
        {t("pr.title")}
      </h2>

      <div className="mb-4 flex gap-1">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant="tab"
            size="sm"
            active={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading && <Loading />}

      {error && (
        <p className="p-2 text-[0.9rem] text-danger">
          {t("common.error", { message: error })}
        </p>
      )}

      {!loading && !error && filteredPrs.length === 0 && (
        <EmptyState message={t("pr.empty")} />
      )}

      {!loading &&
        !error &&
        filteredPrs.map((pr) => (
          <div key={pr.number}>
            <div
              className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-3.5 transition-colors last:border-b-0 hover:bg-bg-hover"
              onClick={() => handlePrClick(pr)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text-muted">
                    #{pr.number}
                  </span>
                  <span className="truncate text-sm font-medium text-text-primary">
                    {pr.title}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-text-secondary">
                  <span>{pr.author}</span>
                  <span>{t("pr.files", { count: pr.changed_files })}</span>
                  <span className="text-accent">+{pr.additions}</span>
                  <span className="text-danger">-{pr.deletions}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {riskLevels[pr.number] && (
                  <RiskBadge level={riskLevels[pr.number]} />
                )}
                <Badge variant={stateVariant(pr.state)}>
                  <span className="inline-flex items-center gap-1">
                    <PrStateIcon state={pr.state} />
                    {pr.state}
                  </span>
                </Badge>
              </div>
            </div>
            {expandedPr === pr.number && (
              <div className="border-b border-border bg-bg-primary pl-4">
                <CommitListPanel
                  commits={commits}
                  loading={commitsLoading}
                  error={commitsError}
                />
              </div>
            )}
          </div>
        ))}
    </Card>
  );
}
