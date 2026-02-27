import { useState, useEffect, useCallback } from "react";
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
} from "../types";
import { Badge } from "./Badge";
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

interface ReviewTabProps {
  selectedBranch: string | null;
  prs: PrInfo[];
}

export function ReviewTab({ selectedBranch, prs }: ReviewTabProps) {
  const { t } = useTranslation();
  const { repoPath, repoInfo } = useRepository();
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

  // Find matching PR for the selected branch
  const matchedPr = prs.find((pr) => pr.head_branch === selectedBranch) ?? null;

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

    // Load app config for token, then run analysis
    invoke("load_app_config")
      .then((config) => {
        const ghToken = config.github_token;
        if (!ghToken) return;

        // Fetch PR files
        setPrDiffsLoading(true);
        setPrDiffsError(null);
        invoke("get_pull_request_files", {
          owner,
          repo,
          prNumber: matchedPr.number,
          token: ghToken,
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
          token: ghToken,
        })
          .then(setAnalysisResult)
          .catch(() => {});

        // Try hybrid analysis (may fail if LLM not configured)
        invoke("analyze_pr_risk_with_llm", {
          owner,
          repo,
          prNumber: matchedPr.number,
          token: ghToken,
        })
          .then(setHybridResult)
          .catch(() => {});
      })
      .catch(() => {});
  }, [matchedPr, repoInfo]);

  const selectedDiff = selectedIndex >= 0 ? diffs[selectedIndex] : null;
  const selectedPrDiff =
    selectedPrFileIndex >= 0 ? prDiffs[selectedPrFileIndex] : null;

  // No branch selected
  if (!selectedBranch) {
    return (
      <Card>
        <p className="p-4 text-center text-text-secondary">
          {t("review.noBranch")}
        </p>
      </Card>
    );
  }

  // Main branch selected
  if (selectedBranch === "main") {
    return (
      <Card>
        <p className="p-4 text-center text-text-secondary">
          {t("review.mainBranch")}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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

      {/* PR analysis panels (overview — shown if PR exists) */}
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

      {/* PR file diff detail (when PR is matched) */}
      {matchedPr && (
        <Card>
          <h2 className="mb-3 border-b border-border pb-2 text-lg text-text-heading">
            {t("review.prFiles")}
          </h2>
          <div className="grid min-h-[500px] grid-cols-[280px_1fr] gap-4">
            <div className="flex flex-col">
              <div className="scrollbar-custom flex-1 overflow-y-auto">
                {prDiffsLoading && <Loading />}
                {prDiffsError && (
                  <p className="p-2 text-[0.9rem] text-danger">
                    {t("common.error", { message: prDiffsError })}
                  </p>
                )}
                {!prDiffsLoading && !prDiffsError && prDiffs.length === 0 && (
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
                    <Badge variant={statusVariant(diff.status)}>
                      {statusLabel(diff.status)}
                    </Badge>
                    <span
                      className="min-w-0 flex-1 truncate text-text-primary"
                      title={diff.new_path ?? diff.old_path ?? ""}
                    >
                      {diff.new_path ?? diff.old_path ?? "(unknown)"}
                    </span>
                    <Badge
                      variant={categoryBadgeVariant[diff.category] ?? "default"}
                    >
                      {t(`pr.category${diff.category}`)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col overflow-hidden rounded border border-border">
              <div className="scrollbar-custom flex-1 overflow-auto">
                {prDiffsLoading && <Loading />}
                {!prDiffsLoading && !selectedPrDiff && (
                  <p className="p-4 text-[0.9rem] italic text-text-secondary">
                    {t("review.selectFile")}
                  </p>
                )}
                {selectedPrDiff && <DiffViewer diff={selectedPrDiff} />}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Branch diff detail (when no PR is matched) */}
      {!matchedPr && (
        <div className="grid min-h-[500px] grid-cols-[280px_1fr] gap-4">
          <Card className="flex flex-col">
            <h2 className="mb-4 border-b border-border pb-2 text-lg text-text-heading">
              {t("review.changedFiles")}
            </h2>
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
                  <Badge variant={statusVariant(diff.status)}>
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
          <Card className="flex flex-col overflow-hidden">
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
  const [token, setToken] = useState("");
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState<string | null>(null);

  useEffect(() => {
    invoke("load_app_config")
      .then((config) => {
        const ghToken = config.github_token;
        setToken(ghToken);
        if (!ghToken) return;

        // Fetch PR commits
        setCommitsLoading(true);
        setCommitsError(null);
        invoke("list_pr_commits", {
          owner,
          repo,
          prNumber: matchedPr.number,
          token: ghToken,
        })
          .then(setCommits)
          .catch((err) => setCommitsError(String(err)))
          .finally(() => setCommitsLoading(false));
      })
      .catch(() => {});
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

      {/* Risk analysis */}
      {analysisResult && (
        <AnalysisDetailPanel
          result={analysisResult}
          hybridResult={hybridResult ?? undefined}
        />
      )}

      {/* AI Summary */}
      {token && (
        <ChangeSummaryList
          owner={owner}
          repo={repo}
          prNumber={matchedPr.number}
          token={token}
          diffs={prDiffs}
        />
      )}

      {/* Consistency check */}
      {token && (
        <ConsistencyCheckPanel
          owner={owner}
          repo={repo}
          prNumber={matchedPr.number}
          token={token}
        />
      )}

      {/* Review suggestions */}
      {token && (
        <ReviewSuggestionPanel
          owner={owner}
          repo={repo}
          prNumber={matchedPr.number}
          token={token}
        />
      )}

      {/* Review submit */}
      {token && (
        <ReviewSubmit
          matchedPr={matchedPr}
          owner={owner}
          repo={repo}
          token={token}
          analysisResult={analysisResult}
          prDiffs={prDiffs}
        />
      )}

      {/* Automation panel */}
      {token && <AutomationPanel owner={owner} repo={repo} token={token} />}
    </div>
  );
}
