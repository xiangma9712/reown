import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "../invoke";
import type { PrSummary, CategorizedFileDiff, ChangeCategory } from "../types";
import { Card, Panel } from "./Card";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Spinner } from "./Loading";

const categoryIcons: Record<ChangeCategory, string> = {
  Logic: "\u{1F4BB}",
  Refactor: "\u{1F504}",
  Test: "\u{1F9EA}",
  Config: "\u{2699}\uFE0F",
  Documentation: "\u{1F4DD}",
  CI: "\u{1F6E0}\uFE0F",
  Dependency: "\u{1F4E6}",
  Other: "\u{1F4C4}",
};

const categoryLabelKeys: Record<ChangeCategory, string> = {
  Logic: "pr.categoryLogic",
  Refactor: "pr.categoryRefactor",
  Test: "pr.categoryTest",
  Config: "pr.categoryConfig",
  Documentation: "pr.categoryDocumentation",
  CI: "pr.categoryCI",
  Dependency: "pr.categoryDependency",
  Other: "pr.categoryOther",
};

interface ChangeSummaryListProps {
  owner: string;
  repo: string;
  prNumber: number;
  token: string;
  diffs: CategorizedFileDiff[];
  onViewDiff: (fileIndex: number) => void;
}

interface StreamingState {
  text: string;
  done: boolean;
}

function findCategoryForPath(
  path: string,
  diffs: CategorizedFileDiff[]
): ChangeCategory | null {
  const match = diffs.find((d) => d.new_path === path || d.old_path === path);
  return match?.category ?? null;
}

function findDiffIndexForPath(
  path: string,
  diffs: CategorizedFileDiff[]
): number {
  return diffs.findIndex((d) => d.new_path === path || d.old_path === path);
}

export function ChangeSummaryList({
  owner,
  repo,
  prNumber,
  token,
  diffs,
  onViewDiff,
}: ChangeSummaryListProps) {
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

  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

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
        }
      );
    } catch {
      // Event listening is optional
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

  // No summary yet and not loading — show generate button
  if (!summary && !loading && !error) {
    return (
      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg text-text-heading">
            {t("pr.changeSummaryTitle")}
          </h2>
          <Button onClick={handleGenerate}>{t("pr.generateSummary")}</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-text-heading">
          {t("pr.changeSummaryTitle")}
        </h2>
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

      {/* Summary content */}
      {summary && !loading && (
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

          {/* File summaries list */}
          {summary.file_summaries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[0.85rem] font-semibold text-text-heading">
                {t("pr.fileSummaries")}
              </h3>
              {summary.file_summaries.map((file, i) => {
                const category = findCategoryForPath(file.path, diffs);
                const diffIndex = findDiffIndexForPath(file.path, diffs);
                return (
                  <Panel key={i} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-[0.8rem] font-semibold text-info">
                        {file.path}
                      </span>
                      {category && (
                        <Badge variant="default" className="shrink-0">
                          {categoryIcons[category]}{" "}
                          {t(categoryLabelKeys[category])}
                        </Badge>
                      )}
                      {diffIndex >= 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto shrink-0"
                          onClick={() => onViewDiff(diffIndex)}
                        >
                          {t("pr.viewDiff")}
                        </Button>
                      )}
                    </div>
                    <p className="text-[0.8rem] text-text-secondary">
                      {file.summary}
                    </p>
                  </Panel>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
