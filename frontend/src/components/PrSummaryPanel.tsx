import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "../invoke";
import type { PrSummary } from "../types";
import { Card, Panel } from "./Card";
import { Button } from "./Button";
import { Spinner } from "./Loading";

interface PrSummaryPanelProps {
  owner: string;
  repo: string;
  prNumber: number;
}

export function PrSummaryPanel({ owner, repo, prNumber }: PrSummaryPanelProps) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<PrSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const cancelledRef = useRef(false);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Cleanup listener on unmount
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
    setStreamingText("");
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
    setStreamingText("");

    if (unlistenRef.current) {
      unlistenRef.current();
    }
    try {
      unlistenRef.current = await listen<string>(
        `summary-stream-${prNumber}`,
        (event) => {
          if (!cancelledRef.current) {
            setStreamingText((prev) => prev + event.payload);
          }
        }
      );
    } catch {
      // Event listening is optional
    }

    try {
      const result = await invoke("summarize_pull_request", {
        owner: owner.trim(),
        repo: repo.trim(),
        prNumber,
      });
      if (cancelledRef.current) return;
      setSummary(result);
      setStreamingText("");
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
  }, [owner, repo, prNumber]);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-text-heading">{t("pr.prSummary")}</h2>
        {loading ? (
          <Button variant="secondary" size="sm" onClick={handleCancel}>
            {t("pr.cancelGeneration")}
          </Button>
        ) : (
          <Button
            variant={summary ? "secondary" : "primary"}
            size="sm"
            onClick={handleGenerate}
          >
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
          {streamingText && (
            <Panel>
              <p className="whitespace-pre-wrap text-[0.85rem] text-text-primary">
                {streamingText}
                <span className="inline-block animate-pulse">|</span>
              </p>
            </Panel>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <p className="text-[0.85rem] text-danger">
          {t("pr.summaryError")}: {error}
        </p>
      )}

      {/* Summary content */}
      {summary && !loading && (
        <div className="space-y-3">
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
            <div className="space-y-2">
              <h3 className="text-[0.85rem] font-semibold text-text-heading">
                {t("pr.fileSummaries")}
              </h3>
              {summary.file_summaries.map((file) => (
                <Panel key={file.path} className="space-y-1">
                  <span className="truncate font-mono text-[0.8rem] font-semibold text-info">
                    {file.path}
                  </span>
                  <p className="text-[0.8rem] text-text-secondary">
                    {file.summary}
                  </p>
                </Panel>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
