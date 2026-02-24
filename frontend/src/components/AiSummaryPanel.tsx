import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "../invoke";
import type { PrSummary } from "../types";
import { Card, Panel } from "./Card";
import { Button } from "./Button";
import { Spinner } from "./Loading";

interface AiSummaryPanelProps {
  owner: string;
  repo: string;
  prNumber: number;
  token: string;
}

interface StreamingState {
  text: string;
  done: boolean;
}

export function AiSummaryPanel({
  owner,
  repo,
  prNumber,
  token,
}: AiSummaryPanelProps) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<PrSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<StreamingState>({
    text: "",
    done: false,
  });
  const cancelledRef = useRef(false);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  // Reset when PR changes
  useEffect(() => {
    setSummary(null);
    setError(null);
    setLoading(false);
    setStreaming({ text: "", done: false });
  }, [prNumber]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setLoading(false);
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    cancelledRef.current = false;
    setLoading(true);
    setError(null);
    setSummary(null);
    setStreaming({ text: "", done: false });

    // Listen for streaming events
    if (unlistenRef.current) {
      unlistenRef.current();
    }
    try {
      unlistenRef.current = await listen<string>(
        `summary-stream-${prNumber}`,
        (event) => {
          if (!cancelledRef.current) {
            setStreaming((prev) => ({
              text: prev.text + event.payload,
              done: false,
            }));
          }
        },
      );
    } catch {
      // Event listening is optional — backend may not emit events
    }

    const args = {
      owner: owner.trim(),
      repo: repo.trim(),
      prNumber,
      token: token.trim(),
    };

    try {
      const summaryResult = await invoke("summarize_pull_request", args);

      if (cancelledRef.current) return;

      setSummary(summaryResult);
      setStreaming({ text: "", done: true });
    } catch (err) {
      if (!cancelledRef.current) {
        setError(String(err));
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    }
  }, [owner, repo, prNumber, token]);

  // Show generate button when no summary yet and not loading
  if (!summary && !loading && !error) {
    return (
      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg text-text-heading">{t("pr.aiSummary")}</h2>
          <Button onClick={handleGenerate}>{t("pr.generateSummary")}</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-text-heading">{t("pr.aiSummary")}</h2>
        {loading && (
          <Button variant="secondary" size="sm" onClick={handleCancel}>
            {t("pr.cancelGeneration")}
          </Button>
        )}
        {!loading && summary && (
          <Button variant="secondary" size="sm" onClick={handleGenerate}>
            {t("pr.generateSummary")}
          </Button>
        )}
      </div>

      {/* Loading state with streaming text */}
      {loading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            <span className="text-[0.85rem] text-text-secondary">
              {t("pr.generatingSummary")}
            </span>
          </div>
          {streaming.text && (
            <Panel>
              <p className="whitespace-pre-wrap text-[0.85rem] text-text-primary">
                {streaming.text}
                <span className="inline-block animate-pulse">|</span>
              </p>
            </Panel>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="space-y-2">
          <p className="text-[0.85rem] text-danger">
            {t("pr.summaryError")}: {error}
          </p>
          <Button variant="secondary" size="sm" onClick={handleGenerate}>
            {t("pr.generateSummary")}
          </Button>
        </div>
      )}

      {/* Summary result */}
      {summary && !loading && <SummaryContent summary={summary} />}
    </Card>
  );
}

function SummaryContent({ summary }: { summary: PrSummary }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Overall summary */}
      <Panel>
        <h3 className="mb-2 text-[0.85rem] font-semibold text-text-heading">
          {t("pr.overallSummary")}
        </h3>
        <p className="whitespace-pre-wrap text-[0.85rem] text-text-primary">
          {summary.overall_summary}
        </p>
      </Panel>

      {/* Change reason */}
      {summary.reason && (
        <Panel>
          <h3 className="mb-2 text-[0.85rem] font-semibold text-text-heading">
            {t("pr.changeReason")}
          </h3>
          <p className="whitespace-pre-wrap text-[0.85rem] text-text-primary">
            {summary.reason}
          </p>
        </Panel>
      )}

      {/* File summaries */}
      {summary.file_summaries.length > 0 && (
        <Panel>
          <h3 className="mb-2 text-[0.85rem] font-semibold text-text-heading">
            {t("pr.fileSummaries")}
          </h3>
          <div className="space-y-2">
            {summary.file_summaries.map((file, i) => (
              <div key={i} className="text-[0.8rem]">
                <span className="font-mono font-semibold text-info">
                  {file.path}
                </span>
                <p className="mt-0.5 text-text-secondary">{file.summary}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
