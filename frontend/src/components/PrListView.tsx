import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PrInfo, RiskLevel } from "../types";
import { Badge } from "./Badge";
import { Card } from "./Card";
import { Loading } from "./Loading";
import { RiskBadge } from "./RiskBadge";

type FilterState = "all" | "open" | "closed" | "merged";

interface PrListViewProps {
  prs: PrInfo[];
  loading?: boolean;
  error?: string | null;
  riskLevels?: Record<number, RiskLevel>;
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

export function PrListView({
  prs,
  loading = false,
  error = null,
  riskLevels = {},
  onSelectPr,
}: PrListViewProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterState>("all");

  const filteredPrs =
    filter === "all" ? prs : prs.filter((pr) => pr.state === filter);

  const filters: { key: FilterState; label: string }[] = [
    { key: "all", label: t("pr.filterAll") },
    { key: "open", label: t("pr.filterOpen") },
    { key: "closed", label: t("pr.filterClosed") },
    { key: "merged", label: t("pr.filterMerged") },
  ];

  return (
    <Card>
      <h2 className="mb-3 border-b border-border pb-2 text-lg text-text-heading">
        {t("pr.title")}
      </h2>

      <div className="mb-4 flex gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              filter === f.key
                ? "bg-accent text-white"
                : "bg-btn-secondary text-text-secondary hover:bg-bg-hover"
            }`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <Loading />}

      {error && (
        <p className="p-2 text-[0.9rem] text-danger">
          {t("common.error", { message: error })}
        </p>
      )}

      {!loading && !error && filteredPrs.length === 0 && (
        <p className="p-4 text-center text-sm italic text-text-secondary">
          {t("pr.empty")}
        </p>
      )}

      {!loading &&
        !error &&
        filteredPrs.map((pr) => (
          <div
            key={pr.number}
            className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 transition-colors last:border-b-0 hover:bg-bg-hover"
            onClick={() => onSelectPr?.(pr)}
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
              <div className="mt-0.5 flex items-center gap-2 text-xs text-text-secondary">
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
              <Badge variant={stateVariant(pr.state)}>{pr.state}</Badge>
            </div>
          </div>
        ))}
    </Card>
  );
}
