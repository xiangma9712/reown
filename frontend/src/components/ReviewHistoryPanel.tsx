import { useTranslation } from "react-i18next";
import type { ReviewRecord } from "../types";
import { Badge } from "./Badge";
import { RiskBadge } from "./RiskBadge";
import { Card } from "./Card";

interface ReviewHistoryPanelProps {
  records: ReviewRecord[];
}

const categoryBadgeVariant: Record<
  string,
  "success" | "danger" | "warning" | "info" | "default" | "purple"
> = {
  Logic: "warning",
  Refactor: "info",
  Test: "success",
  Config: "default",
  Documentation: "default",
  CI: "purple",
  Dependency: "default",
  Other: "default",
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export function ReviewHistoryPanel({ records }: ReviewHistoryPanelProps) {
  const { t } = useTranslation();

  const sorted = [...records].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
        <h2 className="text-lg text-text-heading">
          {t("reviewHistory.title")}
        </h2>
        {sorted.length > 0 && (
          <span className="text-xs text-text-muted">
            {t("reviewHistory.count", { count: sorted.length })}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="p-4 text-center text-sm text-text-secondary">
          {t("reviewHistory.empty")}
        </p>
      ) : (
        <div className="space-y-0">
          {sorted.map((record, index) => (
            <div
              key={`${record.pr_number}-${record.timestamp}-${index}`}
              className="flex items-center gap-3 border-b border-border px-2 py-2.5 text-sm last:border-b-0"
            >
              {/* Action badge */}
              <Badge
                variant={record.action === "APPROVE" ? "success" : "danger"}
              >
                {record.action === "APPROVE"
                  ? t("reviewHistory.approve")
                  : t("reviewHistory.requestChanges")}
              </Badge>

              {/* PR number + repo */}
              <span className="shrink-0 font-mono text-xs text-text-secondary">
                {t("reviewHistory.pr", { number: record.pr_number })}
              </span>
              <span
                className="min-w-0 truncate text-xs text-text-muted"
                title={record.repository}
              >
                {record.repository}
              </span>

              {/* Risk badge */}
              <RiskBadge level={record.risk_level} />

              {/* Categories */}
              {record.categories.length > 0 && (
                <div className="flex gap-1">
                  {record.categories.map((cat) => (
                    <Badge
                      key={cat}
                      variant={categoryBadgeVariant[cat] ?? "default"}
                    >
                      {t(`pr.category${cat}`)}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Timestamp */}
              <span className="ml-auto shrink-0 text-xs text-text-muted">
                {formatTimestamp(record.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
