import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import type {
  AutoApproveCandidate,
  AutomationConfig,
  ApproveWithMergeOutcome,
} from "../types";
import { Card } from "./Card";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { RiskBadge } from "./RiskBadge";
import { AutoMergeBadge } from "./AutoMergeBadge";
import { Loading } from "./Loading";
import { ConfirmDialog } from "./ConfirmDialog";

type Phase = "idle" | "evaluating" | "confirm" | "executing" | "done";

interface AutomationPanelProps {
  owner: string;
  repo: string;
}

export function AutomationPanel({ owner, repo }: AutomationPanelProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [candidates, setCandidates] = useState<AutoApproveCandidate[]>([]);
  const [outcomes, setOutcomes] = useState<ApproveWithMergeOutcome[]>([]);
  const [automationConfig, setAutomationConfig] =
    useState<AutomationConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluated, setEvaluated] = useState(false);

  const handleEvaluate = useCallback(async () => {
    setPhase("evaluating");
    setError(null);
    setCandidates([]);
    setOutcomes([]);
    try {
      const config = await invoke("load_automation_config", { owner, repo });
      setAutomationConfig(config);

      if (!config.enabled) {
        setPhase("idle");
        return;
      }

      const result = await invoke("evaluate_auto_approve_candidates", {
        owner,
        repo,
      });
      setCandidates(result);
      setEvaluated(true);
      if (result.length === 0) {
        setPhase("idle");
      } else {
        setPhase("confirm");
      }
    } catch (err) {
      setError(String(err));
      setPhase("idle");
    }
  }, [owner, repo]);

  const handleExecute = useCallback(async () => {
    if (!automationConfig || candidates.length === 0) return;
    setPhase("executing");
    setError(null);
    try {
      const result = await invoke("run_auto_approve_with_merge", {
        owner,
        repo,
        candidates,
        automationConfig,
      });
      setOutcomes(result.outcomes);
      setPhase("done");
    } catch (err) {
      setError(String(err));
      setPhase("done");
    }
  }, [owner, repo, candidates, automationConfig]);

  const approvedCount = outcomes.filter((o) => o.approve_success).length;
  const failedCount = outcomes.filter((o) => !o.approve_success).length;

  return (
    <Card>
      <h2 className="mb-3 border-b border-border pb-2 text-lg text-text-heading">
        {t("automationPanel.title")}
      </h2>

      {/* Idle / Evaluate button */}
      {phase === "idle" && (
        <div className="space-y-3">
          {error && (
            <p className="text-[0.85rem] text-danger">
              {t("pr.autoApproveError")}: {error}
            </p>
          )}
          {/* ③ 評価済みで候補なしの場合、専用の空状態メッセージを表示 */}
          {evaluated && candidates.length === 0 && outcomes.length === 0 && (
            <EmptyState message={t("pr.autoApproveNoCandidates")} />
          )}
          {/* ① 未評価時は説明テキストを表示してボタンのコンテキストを明確にする */}
          {!evaluated && outcomes.length === 0 && (
            <p className="text-[0.85rem] text-text-secondary">
              {t("automationPanel.description")}
            </p>
          )}
          <Button onClick={handleEvaluate} variant="primary">
            {t("pr.autoApproveRun")}
          </Button>
        </div>
      )}

      {/* Evaluating */}
      {phase === "evaluating" && (
        <div className="flex items-center gap-2">
          <Loading />
          <span className="text-[0.85rem] text-text-secondary">
            {t("pr.autoApproveEvaluating")}
          </span>
        </div>
      )}

      {/* ② Confirm dialog with candidate list inside dialog */}
      {phase === "confirm" && (
        <ConfirmDialog
          open={true}
          message={t("pr.autoApproveConfirm")}
          onConfirm={handleExecute}
          onCancel={() => {
            setPhase("idle");
            setEvaluated(false);
          }}
          confirmLabel={t("pr.autoApproveRun")}
          confirmVariant="primary"
        >
          <div className="mb-4 space-y-2">
            {candidates.map((c) => (
              <div
                key={c.pr_number}
                className="flex items-center gap-3 rounded border border-border px-3 py-2 text-[0.85rem]"
              >
                <span className="font-medium text-text-primary">
                  #{c.pr_number}
                </span>
                <RiskBadge level={c.risk_level} />
                <span className="min-w-0 flex-1 truncate text-text-secondary">
                  {c.reason}
                </span>
              </div>
            ))}
          </div>
        </ConfirmDialog>
      )}

      {/* Executing */}
      {phase === "executing" && (
        <div className="flex items-center gap-2">
          <Loading />
          <span className="text-[0.85rem] text-text-secondary">
            {t("pr.autoApproveExecuting")}
          </span>
        </div>
      )}

      {/* Results */}
      {phase === "done" && (
        <div className="space-y-3">
          {/* Summary */}
          <div
            className={`rounded border px-4 py-2 text-[0.85rem] ${
              failedCount === 0 && !error
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            {error
              ? `${t("pr.autoApproveError")}: ${error}`
              : t("automationPanel.resultSummary", {
                  approved: approvedCount,
                  failed: failedCount,
                })}
          </div>

          {/* Outcome list */}
          {outcomes.length > 0 && (
            <div className="space-y-2">
              {outcomes.map((o) => (
                <div
                  key={o.pr_number}
                  className="flex items-center gap-3 rounded border border-border px-3 py-2 text-[0.85rem]"
                >
                  <span className="font-medium text-text-primary">
                    #{o.pr_number}
                  </span>
                  <span
                    className={
                      o.approve_success ? "text-success" : "text-danger"
                    }
                  >
                    {o.approve_success
                      ? t("pr.autoApproveResultApproved")
                      : t("pr.autoApproveResultFailed")}
                  </span>
                  {o.approve_error && (
                    <span className="min-w-0 flex-1 truncate text-danger">
                      {o.approve_error}
                    </span>
                  )}
                  <AutoMergeBadge status={o.auto_merge_status} />
                </div>
              ))}
            </div>
          )}

          {/* Back to idle */}
          <Button onClick={() => setPhase("idle")} variant="secondary">
            {t("pr.autoApproveRun")}
          </Button>
        </div>
      )}
    </Card>
  );
}
