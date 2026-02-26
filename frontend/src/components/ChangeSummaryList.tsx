import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "../invoke";
import type {
  PrSummary,
  CategorizedFileDiff,
  ChangeCategory,
  DiffChunk,
} from "../types";
import { Panel } from "./Card";
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

/** Extract unique categories from diffs, ordered by the canonical order. */
const allCategories: ChangeCategory[] = [
  "Logic",
  "Refactor",
  "Test",
  "Config",
  "Documentation",
  "CI",
  "Dependency",
  "Other",
];

function CategoryFilter({
  diffs,
  activeCategories,
  onToggle,
  onShowAll,
}: {
  diffs: CategorizedFileDiff[];
  activeCategories: Set<ChangeCategory>;
  onToggle: (category: ChangeCategory) => void;
  onShowAll: () => void;
}) {
  const { t } = useTranslation();

  const presentCategories = useMemo(() => {
    const cats = new Set(diffs.map((d) => d.category));
    return allCategories.filter((c) => cats.has(c));
  }, [diffs]);

  const isAllActive = activeCategories.size === 0;

  const filteredCount = isAllActive
    ? diffs.length
    : diffs.filter((d) => activeCategories.has(d.category)).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            isAllActive
              ? "bg-accent text-bg-primary"
              : "bg-bg-hover text-text-secondary hover:text-text-primary"
          }`}
          onClick={onShowAll}
        >
          {t("pr.categoryFilterAll")}
        </button>
        {presentCategories.map((category) => {
          const isActive = activeCategories.has(category);
          return (
            <button
              key={category}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-accent text-bg-primary"
                  : "bg-bg-hover text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => onToggle(category)}
            >
              {categoryIcons[category]} {t(categoryLabelKeys[category])}
            </button>
          );
        })}
      </div>
      {!isAllActive && (
        <span className="text-xs text-text-secondary">
          {t("pr.categoryFilterCount", {
            count: filteredCount,
            total: diffs.length,
          })}
        </span>
      )}
    </div>
  );
}

interface ChangeSummaryListProps {
  owner: string;
  repo: string;
  prNumber: number;
  token: string;
  diffs: CategorizedFileDiff[];
  autoGenerate?: boolean;
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

function getOriginString(
  origin: "Addition" | "Deletion" | "Context" | { Other: string }
): string {
  if (typeof origin === "string") return origin;
  return "Other";
}

function InlineDiffView({ chunks }: { chunks: DiffChunk[] }) {
  const { t } = useTranslation();
  if (chunks.length === 0) {
    return (
      <p className="p-2 text-[0.9rem] italic text-text-secondary">
        {t("diff.noDiffContent")}
      </p>
    );
  }
  return (
    <>
      {chunks.map((chunk, ci) => (
        <div key={ci}>
          <div className="border-y border-border bg-diff-header-bg px-3 py-1 text-xs text-info">
            {chunk.header}
          </div>
          {chunk.lines.map((line, li) => {
            const origin = getOriginString(line.origin);
            const lineClass =
              origin === "Addition"
                ? "diff-line-addition"
                : origin === "Deletion"
                  ? "diff-line-deletion"
                  : "";
            const prefix =
              origin === "Addition" ? "+" : origin === "Deletion" ? "-" : " ";
            const textColor =
              origin === "Addition"
                ? "text-accent"
                : origin === "Deletion"
                  ? "text-danger"
                  : "text-text-secondary";
            return (
              <div key={li} className={`flex whitespace-pre ${lineClass}`}>
                <span className="inline-block min-w-[3.5em] shrink-0 select-none px-2 text-right text-text-muted">
                  {line.old_lineno ?? ""}
                </span>
                <span className="inline-block min-w-[3.5em] shrink-0 select-none px-2 text-right text-text-muted">
                  {line.new_lineno ?? ""}
                </span>
                <span className={`flex-1 px-2 ${textColor}`}>
                  {prefix}
                  {line.content}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

export function ChangeSummaryList({
  owner,
  repo,
  prNumber,
  token,
  diffs,
  autoGenerate = false,
}: ChangeSummaryListProps) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<PrSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<StreamingState>({
    text: "",
    done: false,
  });
  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set());
  const [activeCategories, setActiveCategories] = useState<Set<ChangeCategory>>(
    new Set()
  );
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

  const autoGeneratedRef = useRef<number | null>(null);

  useEffect(() => {
    setSummary(null);
    setError(null);
    setLoading(false);
    setStreaming({ text: "", done: false });
    setExpandedDiffs(new Set());
    setActiveCategories(new Set());
    autoGeneratedRef.current = null;
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

  // Auto-generate summary when LLM is configured
  useEffect(() => {
    if (
      autoGenerate &&
      !summary &&
      !loading &&
      !error &&
      autoGeneratedRef.current !== prNumber
    ) {
      autoGeneratedRef.current = prNumber;
      handleGenerate();
    }
  }, [autoGenerate, prNumber, summary, loading, error, handleGenerate]);

  const handleToggleCategory = useCallback((category: ChangeCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleShowAllCategories = useCallback(() => {
    setActiveCategories(new Set());
  }, []);

  const filteredFileSummaries = useMemo(() => {
    if (!summary || activeCategories.size === 0) {
      return summary?.file_summaries ?? [];
    }
    return summary.file_summaries.filter((file) => {
      const category = findCategoryForPath(file.path, diffs);
      return category !== null && activeCategories.has(category);
    });
  }, [summary, activeCategories, diffs]);

  // No summary yet and not loading — show generate button
  if (!summary && !loading && !error) {
    return (
      <div className="py-2">
        <div className="flex items-center justify-between">
          <span className="text-[0.85rem] text-text-secondary">
            {t("pr.changeSummaryTitle")}
          </span>
          <Button onClick={handleGenerate}>{t("pr.generateSummary")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.85rem] font-semibold text-text-heading">
          {t("pr.changeSummaryTitle")}
        </span>
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

          {/* Category filter */}
          {diffs.length > 0 && (
            <CategoryFilter
              diffs={diffs}
              activeCategories={activeCategories}
              onToggle={handleToggleCategory}
              onShowAll={handleShowAllCategories}
            />
          )}

          {/* File summaries list */}
          {filteredFileSummaries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[0.85rem] font-semibold text-text-heading">
                {t("pr.fileSummaries")}
              </h3>
              {filteredFileSummaries.map((file) => {
                const category = findCategoryForPath(file.path, diffs);
                const diffIndex = findDiffIndexForPath(file.path, diffs);
                const isDiffExpanded = expandedDiffs.has(file.path);
                const fileDiff = diffIndex >= 0 ? diffs[diffIndex] : undefined;
                return (
                  <Panel key={file.path} className="space-y-1">
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
                          onClick={() => {
                            setExpandedDiffs((prev) => {
                              const next = new Set(prev);
                              if (next.has(file.path)) {
                                next.delete(file.path);
                              } else {
                                next.add(file.path);
                              }
                              return next;
                            });
                          }}
                        >
                          {isDiffExpanded ? t("pr.hideDiff") : t("pr.viewDiff")}
                        </Button>
                      )}
                    </div>
                    <p className="text-[0.8rem] text-text-secondary">
                      {file.summary}
                    </p>
                    {isDiffExpanded && fileDiff && (
                      <div className="mt-2 overflow-x-auto rounded border border-border bg-bg-secondary font-mono text-[0.8rem] leading-relaxed">
                        <InlineDiffView chunks={fileDiff.chunks} />
                      </div>
                    )}
                  </Panel>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
