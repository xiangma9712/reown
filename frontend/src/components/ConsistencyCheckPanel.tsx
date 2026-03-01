import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import type { ConsistencyResult } from "../types";
import { Card, Panel } from "./Card";
import { Button } from "./Button";
import { Spinner } from "./Loading";

interface ConsistencyCheckPanelProps {
  owner: string;
  repo: string;
  prNumber: number;
}

export function ConsistencyCheckPanel({
  owner,
  repo,
  prNumber,
}: ConsistencyCheckPanelProps) {
  const { t } = useTranslation();
  const [consistency, setConsistency] = useState<ConsistencyResult | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when PR changes
  useEffect(() => {
    setConsistency(null);
    setError(null);
    setLoading(false);
  }, [prNumber]);

  const handleCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConsistency(null);
    try {
      const result = await invoke("check_pr_consistency", {
        owner: owner.trim(),
        repo: repo.trim(),
        prNumber,
      });
      setConsistency(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [owner, repo, prNumber]);

  const hasResult = consistency || error;

  return (
    <Card className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-text-heading">
          {t("pr.consistencyCheck")}
        </h2>
        {!hasResult && !loading && (
          <Button variant="primary" size="sm" onClick={handleCheck}>
            {t("pr.consistencyRun")}
          </Button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2">
          <Spinner size="sm" />
          <span className="text-[0.85rem] text-text-secondary">
            {t("pr.consistencyChecking")}
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <p className="text-[0.85rem] text-danger">
          {t("pr.consistencyError")}: {error}
        </p>
      )}

      {/* Result */}
      {consistency && !loading && (
        <ConsistencyBanner consistency={consistency} />
      )}

      {/* Re-check button at the bottom after result or error */}
      {hasResult && !loading && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCheck}
            className="gap-1.5"
          >
            <RefreshIcon />
            {t("pr.consistencyRecheck")}
          </Button>
        </div>
      )}
    </Card>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

function ConsistencyBanner({
  consistency,
}: {
  consistency: ConsistencyResult;
}) {
  const { t } = useTranslation();

  if (consistency.is_consistent) {
    return (
      <div className="flex items-center gap-2 rounded border border-accent/30 bg-accent/10 px-3 py-2 text-[0.85rem] text-accent">
        <span>{t("pr.consistencyOk")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-[0.85rem] text-warning">
        <span>{t("pr.consistencyWarning")}</span>
      </div>
      {consistency.warnings.length > 0 && (
        <Panel>
          <h3 className="mb-2 text-[0.85rem] font-semibold text-text-heading">
            {t("pr.consistencyWarnings")}
          </h3>
          <ul className="space-y-2">
            {consistency.warnings.map((warning, i) => (
              <li key={i} className="flex items-start gap-2 text-[0.8rem]">
                <span className="mt-0.5 shrink-0 rounded bg-warning/15 px-1.5 py-0.5 text-[0.7rem] font-semibold text-warning">
                  {t("pr.consistencyWarningLabel")}
                </span>
                <span className="text-text-primary">{warning}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
