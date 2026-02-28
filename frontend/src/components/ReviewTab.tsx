import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import { useRepository } from "../RepositoryContext";
import type {
  FileDiff,
  PrInfo,
  AnalysisResult,
  HybridAnalysisResult,
  CategorizedFileDiff,
  CommitInfo,
  ReviewRecord,
} from "../types";
import { Badge } from "./Badge";
import { BranchSelector } from "./BranchSelector";
import { Card } from "./Card";
import { Loading } from "./Loading";
import { DiffViewer } from "./DiffViewer";
import { AnalysisDetailPanel } from "./AnalysisDetailPanel";
import { ChangeSummaryList } from "./ChangeSummaryList";
import { CommitListPanel } from "./CommitListPanel";
import { ConsistencyCheckPanel } from "./ConsistencyCheckPanel";
import { ReviewSuggestionPanel } from "./ReviewSuggestionPanel";
import { ReviewSubmit } from "./ReviewSubmit";
import { AutomationPanel } from "./AutomationPanel";
import { PrSummaryPanel } from "./PrSummaryPanel";
import { ReviewHistoryPanel } from "./ReviewHistoryPanel";

const FILE_LIST_WIDTH_KEY = "reown-filelist-width";
const FILE_LIST_COLLAPSED_KEY = "reown-filelist-collapsed";
const DEFAULT_FILE_LIST_WIDTH = 280;
const MIN_FILE_LIST_WIDTH = 180;
const MAX_FILE_LIST_WIDTH = 480;

function statusLabel(status: string): string {
  switch (status) {
    case "Added":
      return "A";
    case "Deleted":
      return "D";
    case "Modified":
      return "M";
    case "Renamed":
      return "R";
    default:
      return "?";
  }
}

function statusAriaLabel(status: string): string {
  switch (status) {
    case "Added":
      return "Added";
    case "Deleted":
      return "Deleted";
    case "Modified":
      return "Modified";
    case "Renamed":
      return "Renamed";
    default:
      return "Unknown";
  }
}

function useFileListPanel() {
  const [fileListWidth, setFileListWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(FILE_LIST_WIDTH_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (parsed >= MIN_FILE_LIST_WIDTH && parsed <= MAX_FILE_LIST_WIDTH) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_FILE_LIST_WIDTH;
  });
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(FILE_LIST_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(FILE_LIST_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeRef.current = { startX: e.clientX, startWidth: fileListWidth };
      setResizing(true);
    },
    [fileListWidth]
  );

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.min(
        MAX_FILE_LIST_WIDTH,
        Math.max(MIN_FILE_LIST_WIDTH, resizeRef.current.startWidth + delta)
      );
      setFileListWidth(newWidth);
    };

    const handleMouseUp = () => {
      setResizing(false);
      resizeRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

  // Persist width when resizing ends
  const prevResizingRef = useRef(false);
  useEffect(() => {
    if (prevResizingRef.current && !resizing) {
      try {
        localStorage.setItem(FILE_LIST_WIDTH_KEY, String(fileListWidth));
      } catch {
        // ignore
      }
    }
    prevResizingRef.current = resizing;
  }, [resizing, fileListWidth]);

  return {
    fileListWidth,
    collapsed,
    resizing,
    toggleCollapse,
    handleResizeStart,
  };
}

function statusVariant(
  status: string
): "success" | "danger" | "warning" | "info" | "default" {
  switch (status) {
    case "Added":
      return "success";
    case "Deleted":
      return "danger";
    case "Modified":
      return "warning";
    case "Renamed":
      return "info";
    default:
      return "default";
  }
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

function CollapseToggleButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onToggle}
      className="shrink-0 cursor-pointer rounded border-none bg-transparent p-0.5 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={
        collapsed ? t("review.expandFileList") : t("review.collapseFileList")
      }
      title={
        collapsed ? t("review.expandFileList") : t("review.collapseFileList")
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {collapsed ? (
          <>
            <polyline points="13 17 18 12 13 7" />
            <polyline points="6 17 11 12 6 7" />
          </>
        ) : (
          <>
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </>
        )}
      </svg>
    </button>
  );
}

interface ReviewTabProps {
  prs?: PrInfo[];
  loadingPrs?: boolean;
}

export function ReviewTab({ prs = [], loadingPrs = false }: ReviewTabProps) {
  const { t } = useTranslation();
  const { repoPath, repoInfo } = useRepository();
  const {
    fileListWidth,
    collapsed: fileListCollapsed,
    resizing: fileListResizing,
    toggleCollapse: toggleFileListCollapse,
    handleResizeStart: handleFileListResizeStart,
  } = useFileListPanel();
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PR analysis state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [hybridResult, setHybridResult] = useState<HybridAnalysisResult | null>(
    null
  );
  const [prDiffs, setPrDiffs] = useState<CategorizedFileDiff[]>([]);
  const [prDiffsLoading, setPrDiffsLoading] = useState(false);
  const [prDiffsError, setPrDiffsError] = useState<string | null>(null);
  const [selectedPrFileIndex, setSelectedPrFileIndex] = useState(-1);

  // Review history state
  const [reviewHistory, setReviewHistory] = useState<ReviewRecord[]>([]);

  // Load review history on mount
  useEffect(() => {
    invoke("list_review_history")
      .then(setReviewHistory)
      .catch(() => {});
  }, []);

  // TODO: implement PR loading logic — matchedPr is always null until then
  const [matchedPr] = useState<PrInfo | null>(null);

  const loadDiff = useCallback(async () => {
    if (!repoPath || !selectedBranch) return;
    setLoading(true);
    setError(null);
    setAnalysisResult(null);
    setHybridResult(null);
    setPrDiffs([]);
    setPrDiffsError(null);
    setSelectedPrFileIndex(-1);
    try {
      const result = await invoke("diff_branches", {
        repoPath,
        baseRef: "main",
        headRef: selectedBranch,
      });
      setDiffs(result);
      if (result.length > 0) {
        setSelectedIndex(0);
      } else {
        setSelectedIndex(-1);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [repoPath, selectedBranch]);

  // Auto-load diff when branch changes
  useEffect(() => {
    if (selectedBranch && selectedBranch !== "main") {
      loadDiff();
    } else {
      setDiffs([]);
      setSelectedIndex(-1);
      setError(null);
    }
  }, [selectedBranch, loadDiff]);

  // Load PR analysis data and PR files when matched PR changes
  useEffect(() => {
    if (!matchedPr || !repoInfo?.github_owner || !repoInfo?.github_repo) return;

    const owner = repoInfo.github_owner;
    const repo = repoInfo.github_repo;

    // Fetch PR files
    setPrDiffsLoading(true);
    setPrDiffsError(null);
    invoke("get_pull_request_files", {
      owner,
      repo,
      prNumber: matchedPr.number,
    })
      .then((files) => {
        setPrDiffs(files);
        if (files.length > 0) {
          setSelectedPrFileIndex(0);
        }
      })
      .catch((err) => {
        setPrDiffsError(String(err));
      })
      .finally(() => {
        setPrDiffsLoading(false);
      });

    // Run risk analysis
    invoke("analyze_pr_risk", {
      owner,
      repo,
      prNumber: matchedPr.number,
    })
      .then(setAnalysisResult)
      .catch(() => {});

    // Try hybrid analysis (may fail if LLM not configured)
    invoke("analyze_pr_risk_with_llm", {
      owner,
      repo,
      prNumber: matchedPr.number,
    })
      .then(setHybridResult)
      .catch(() => {});
  }, [matchedPr, repoInfo]);

  const selectedDiff = selectedIndex >= 0 ? diffs[selectedIndex] : null;
  const selectedPrDiff =
    selectedPrFileIndex >= 0 ? prDiffs[selectedPrFileIndex] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BranchSelector
          prs={prs}
          selectedBranch={selectedBranch}
          onSelectBranch={setSelectedBranch}
        />
        {loadingPrs && (
          <span className="text-xs text-text-muted">{t("pr.loadingPrs")}</span>
        )}
      </div>

      {/* No branch selected */}
      {!selectedBranch && (
        <>
          <Card>
            <p className="p-4 text-center text-text-secondary">
              {t("review.noBranch")}
            </p>
          </Card>
          <ReviewHistoryPanel records={reviewHistory} />
        </>
      )}

      {/* Main branch selected */}
      {selectedBranch === "main" && (
        <Card>
          <p className="p-4 text-center text-text-secondary">
            {t("review.mainBranch")}
          </p>
        </Card>
      )}

      {selectedBranch && selectedBranch !== "main" && (
        <>
          {/* === Overview Section (top) === */}

          {/* PR info + diff overview (if PR exists) */}
          {matchedPr && (
            <Card>
              <h2 className="mb-3 border-b border-border pb-2 text-lg text-text-heading">
                {t("review.prInfo")}
              </h2>
              <div className="space-y-1 text-sm">
                <p className="font-medium text-text-primary">
                  {t("review.prTitle", {
                    number: matchedPr.number,
                    title: matchedPr.title,
                  })}
                </p>
                <p className="text-text-secondary">
                  {t("review.prAuthor", { author: matchedPr.author })}
                </p>
                <p className="text-text-secondary">
                  {t("review.prState", { state: matchedPr.state })}
                </p>
              </div>
              {/* Diff stats overview */}
              <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-sm">
                <span className="text-text-secondary">
                  {t("review.diffOverviewFiles", {
                    count: matchedPr.changed_files,
                  })}
                </span>
                <span className="font-mono text-accent">
                  +{matchedPr.additions}
                </span>
                <span className="font-mono text-danger">
                  -{matchedPr.deletions}
                </span>
              </div>
              {matchedPr.body && (
                <p className="mt-2 whitespace-pre-wrap text-[0.85rem] text-text-secondary">
                  {matchedPr.body}
                </p>
              )}
            </Card>
          )}

          {/* No PR: branch diff overview */}
          {!matchedPr && !loading && !error && diffs.length > 0 && (
            <Card>
              <h2 className="mb-3 border-b border-border pb-2 text-lg text-text-heading">
                {t("review.diffOverview")}
              </h2>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-text-secondary">
                  {t("review.diffOverviewFiles", { count: diffs.length })}
                </span>
                <span className="font-mono text-accent">
                  +
                  {diffs.reduce(
                    (sum, d) =>
                      sum +
                      d.chunks.reduce(
                        (cs, c) =>
                          cs +
                          c.lines.filter((l) => l.origin === "Addition").length,
                        0
                      ),
                    0
                  )}
                </span>
                <span className="font-mono text-danger">
                  -
                  {diffs.reduce(
                    (sum, d) =>
                      sum +
                      d.chunks.reduce(
                        (cs, c) =>
                          cs +
                          c.lines.filter((l) => l.origin === "Deletion").length,
                        0
                      ),
                    0
                  )}
                </span>
              </div>
            </Card>
          )}

          {/* PR analysis panels — overview at the top (only shown if PR exists) */}
          {matchedPr && repoInfo?.github_owner && repoInfo?.github_repo && (
            <PrAnalysisSection
              matchedPr={matchedPr}
              owner={repoInfo.github_owner}
              repo={repoInfo.github_repo}
              analysisResult={analysisResult}
              hybridResult={hybridResult}
              prDiffs={prDiffs}
            />
          )}

          {/* No PR message */}
          {!matchedPr && !loading && !error && diffs.length > 0 && (
            <Card>
              <p className="p-2 text-center text-sm text-text-secondary">
                {t("review.noPr")}
              </p>
            </Card>
          )}

          {/* === Detail Section (bottom) === */}

          {/* PR file diff section (when PR is matched) */}
          {matchedPr && (
            <div
              className={`flex min-h-[500px] gap-0${fileListResizing ? " select-none" : ""}`}
            >
              {!fileListCollapsed && (
                <>
                  <Card
                    className="flex shrink-0 flex-col"
                    style={{ width: fileListWidth }}
                  >
                    <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
                      <h2 className="text-lg text-text-heading">
                        {t("review.prFiles")}
                      </h2>
                      <CollapseToggleButton
                        collapsed={false}
                        onToggle={toggleFileListCollapse}
                      />
                    </div>
                    <div className="scrollbar-custom flex-1 overflow-y-auto">
                      {prDiffsLoading && <Loading />}
                      {prDiffsError && (
                        <p className="p-2 text-[0.9rem] text-danger">
                          {t("common.error", { message: prDiffsError })}
                        </p>
                      )}
                      {!prDiffsLoading &&
                        !prDiffsError &&
                        prDiffs.length === 0 && (
                          <p className="p-2 text-[0.9rem] italic text-text-secondary">
                            {t("review.prFilesEmpty")}
                          </p>
                        )}
                      {prDiffs.map((diff, index) => (
                        <div
                          key={diff.new_path ?? diff.old_path ?? index}
                          className={`flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 font-mono text-[0.8rem] transition-colors last:border-b-0 hover:bg-bg-primary ${
                            selectedPrFileIndex === index
                              ? "border-l-2 border-l-accent bg-bg-hover"
                              : ""
                          }`}
                          onClick={() => setSelectedPrFileIndex(index)}
                        >
                          <Badge
                            variant={statusVariant(diff.status)}
                            className="status-badge"
                            aria-label={statusAriaLabel(diff.status)}
                          >
                            {statusLabel(diff.status)}
                          </Badge>
                          <span
                            className="min-w-0 flex-1 truncate text-text-primary"
                            title={diff.new_path ?? diff.old_path ?? ""}
                          >
                            {diff.new_path ?? diff.old_path ?? "(unknown)"}
                          </span>
                          <Badge
                            variant={
                              categoryBadgeVariant[diff.category] ?? "default"
                            }
                          >
                            {t(`pr.category${diff.category}`)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={t("review.resizeFileList")}
                    className={`group flex w-2 shrink-0 cursor-col-resize items-center justify-center hover:bg-accent/20 active:bg-accent/30 ${
                      fileListResizing ? "bg-accent/30" : ""
                    }`}
                    onMouseDown={handleFileListResizeStart}
                  >
                    <div
                      className={`h-8 w-0.5 rounded-full bg-border group-hover:bg-accent/60 group-active:bg-accent ${
                        fileListResizing ? "bg-accent" : ""
                      }`}
                    />
                  </div>
                </>
              )}
              {fileListCollapsed && (
                <div className="flex shrink-0 flex-col items-center gap-2 py-2 pr-2">
                  <CollapseToggleButton
                    collapsed={true}
                    onToggle={toggleFileListCollapse}
                  />
                </div>
              )}
              <Card className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <div className="scrollbar-custom flex-1 overflow-auto">
                  {prDiffsLoading && <Loading />}
                  {!prDiffsLoading && !selectedPrDiff && (
                    <p className="p-4 text-[0.9rem] italic text-text-secondary">
                      {t("review.selectFile")}
                    </p>
                  )}
                  {selectedPrDiff && <DiffViewer diff={selectedPrDiff} />}
                </div>
              </Card>
            </div>
          )}

          {/* Branch diff section (when no PR is matched) */}
          {!matchedPr && (
            <div
              className={`flex min-h-[500px] gap-0${fileListResizing ? " select-none" : ""}`}
            >
              {!fileListCollapsed && (
                <>
                  <Card
                    className="flex shrink-0 flex-col"
                    style={{ width: fileListWidth }}
                  >
                    <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
                      <h2 className="text-lg text-text-heading">
                        {t("review.changedFiles")}
                      </h2>
                      <CollapseToggleButton
                        collapsed={false}
                        onToggle={toggleFileListCollapse}
                      />
                    </div>
                    <div className="scrollbar-custom flex-1 overflow-y-auto">
                      {loading && <Loading />}
                      {error && (
                        <p className="p-2 text-[0.9rem] text-danger">
                          {t("common.error", { message: error })}
                        </p>
                      )}
                      {!loading && !error && diffs.length === 0 && (
                        <p className="p-2 text-[0.9rem] italic text-text-secondary">
                          {t("review.empty")}
                        </p>
                      )}
                      {diffs.map((diff, index) => (
                        <div
                          key={diff.new_path ?? diff.old_path ?? index}
                          className={`flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 font-mono text-[0.8rem] transition-colors last:border-b-0 hover:bg-bg-primary ${
                            selectedIndex === index
                              ? "border-l-2 border-l-accent bg-bg-hover"
                              : ""
                          }`}
                          onClick={() => setSelectedIndex(index)}
                        >
                          <Badge
                            variant={statusVariant(diff.status)}
                            className="status-badge"
                            aria-label={statusAriaLabel(diff.status)}
                          >
                            {statusLabel(diff.status)}
                          </Badge>
                          <span
                            className="truncate text-text-primary"
                            title={diff.new_path ?? diff.old_path ?? ""}
                          >
                            {diff.new_path ?? diff.old_path ?? "(unknown)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={t("review.resizeFileList")}
                    className={`group flex w-2 shrink-0 cursor-col-resize items-center justify-center hover:bg-accent/20 active:bg-accent/30 ${
                      fileListResizing ? "bg-accent/30" : ""
                    }`}
                    onMouseDown={handleFileListResizeStart}
                  >
                    <div
                      className={`h-8 w-0.5 rounded-full bg-border group-hover:bg-accent/60 group-active:bg-accent ${
                        fileListResizing ? "bg-accent" : ""
                      }`}
                    />
                  </div>
                </>
              )}
              {fileListCollapsed && (
                <div className="flex shrink-0 flex-col items-center gap-2 py-2 pr-2">
                  <CollapseToggleButton
                    collapsed={true}
                    onToggle={toggleFileListCollapse}
                  />
                </div>
              )}
              <Card className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <div className="scrollbar-custom flex-1 overflow-auto">
                  {loading && <Loading />}
                  {!loading && !selectedDiff && (
                    <p className="p-4 text-[0.9rem] italic text-text-secondary">
                      {t("review.selectFile")}
                    </p>
                  )}
                  {selectedDiff && <DiffViewer diff={selectedDiff} />}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PrAnalysisSection({
  matchedPr,
  owner,
  repo,
  analysisResult,
  hybridResult,
  prDiffs,
}: {
  matchedPr: PrInfo;
  owner: string;
  repo: string;
  analysisResult: AnalysisResult | null;
  hybridResult: HybridAnalysisResult | null;
  prDiffs: CategorizedFileDiff[];
}) {
  const { t } = useTranslation();
  const [reviewComment, setReviewComment] = useState("");
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState<string | null>(null);

  const handleInsertComment = useCallback((text: string) => {
    setReviewComment((prev) => (prev ? `${prev}\n\n${text}` : text));
  }, []);

  useEffect(() => {
    setCommitsLoading(true);
    setCommitsError(null);
    invoke("list_pr_commits", {
      owner,
      repo,
      prNumber: matchedPr.number,
    })
      .then(setCommits)
      .catch((err) => setCommitsError(String(err)))
      .finally(() => setCommitsLoading(false));
  }, [owner, repo, matchedPr.number]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-text-heading">
        {t("review.prAnalysis")}
      </h2>

      {/* Commit list */}
      <CommitListPanel
        commits={commits}
        loading={commitsLoading}
        error={commitsError}
      />

      {/* PR Summary */}
      <PrSummaryPanel owner={owner} repo={repo} prNumber={matchedPr.number} />

      {/* Risk analysis */}
      {analysisResult && (
        <AnalysisDetailPanel
          result={analysisResult}
          hybridResult={hybridResult ?? undefined}
        />
      )}

      {/* AI Summary */}
      <ChangeSummaryList
        owner={owner}
        repo={repo}
        prNumber={matchedPr.number}
        diffs={prDiffs}
      />

      {/* Consistency check */}
      <ConsistencyCheckPanel
        owner={owner}
        repo={repo}
        prNumber={matchedPr.number}
      />

      {/* Review suggestions */}
      <ReviewSuggestionPanel
        owner={owner}
        repo={repo}
        prNumber={matchedPr.number}
        onInsertComment={handleInsertComment}
      />

      {/* Review submit */}
      <ReviewSubmit
        matchedPr={matchedPr}
        owner={owner}
        repo={repo}
        analysisResult={analysisResult}
        prDiffs={prDiffs}
        comment={reviewComment}
        onCommentChange={setReviewComment}
      />

      {/* Automation panel */}
      <AutomationPanel owner={owner} repo={repo} />
    </div>
  );
}
