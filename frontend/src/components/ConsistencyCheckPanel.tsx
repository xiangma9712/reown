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
  token: string;
}

export function ConsistencyCheckPanel({
  owner,
  repo,
  prNumber,
  token,
}: ConsistencyCheckPanelProps) {
  const { t } = useTranslation();
  const [consistency, setConsistency] = useState<ConsistencyResult | null>(
    null,
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
        token: token.trim(),
      });
      setConsistency(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [owner, repo, prNumber, token]);

  return (
    <Card className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-text-heading">
          {t("pr.consistencyCheck")}
        </h2>
        <Button
          variant={consistency ? "secondary" : "primary"}
          size="sm"
          onClick={handleCheck}
          disabled={loading}
        >
          {loading ? t("pr.consistencyChecking") : t("pr.consistencyRun")}
        </Button>
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
    </Card>
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
          <ul className="space-y-1">
            {consistency.warnings.map((warning, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[0.8rem] text-warning"
              >
                <span className="shrink-0">&#x26A0;&#xFE0F;</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
