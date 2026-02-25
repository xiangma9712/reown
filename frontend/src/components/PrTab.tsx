import { useState, useEffect, useRef, useCallback, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import { useRepository } from "../RepositoryContext";
import type {
  PrInfo,
  CategorizedFileDiff,
  ChangeCategory,
  LlmConfig,
  AutomationConfig,
  AnalysisResult,
  HybridAnalysisResult,
  ReviewEvent,
  AffectedModule,
  CommitInfo,
  FileDiff,
} from "../types";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { Input } from "./Input";
import { Loading } from "./Loading";
import { Spinner } from "./Loading";
import { RiskBadge } from "./RiskBadge";
import { AnalysisDetailPanel } from "./AnalysisDetailPanel";
import { ChangeSummaryList } from "./ChangeSummaryList";
import { ConsistencyCheckPanel } from "./ConsistencyCheckPanel";

function stateVariant(
  state: string
): "success" | "danger" | "purple" | "default" {
  switch (state) {
    case "open":
      return "success";
    case "closed":
      return "danger";
    case "merged":
      return "purple";
    default:
      return "default";
  }
}

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

function getOriginString(
  origin: "Addition" | "Deletion" | "Context" | { Other: string }
): string {
  if (typeof origin === "string") return origin;
  return "Other";
}

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

// カテゴリの表示順序
const categoryOrder: ChangeCategory[] = [
  "Logic",
  "Refactor",
  "Test",
  "Config",
  "Documentation",
  "CI",
  "Dependency",
  "Other",
];

function groupByCategory(diffs: CategorizedFileDiff[]): {
  category: ChangeCategory;
  files: { diff: CategorizedFileDiff; originalIndex: number }[];
}[] {
  const groups = new Map<
    ChangeCategory,
    { diff: CategorizedFileDiff; originalIndex: number }[]
  >();
  diffs.forEach((diff, index) => {
    const list = groups.get(diff.category) ?? [];
    list.push({ diff, originalIndex: index });
    groups.set(diff.category, list);
  });
  return categoryOrder
    .filter((cat) => groups.has(cat))
    .map((cat) => ({ category: cat, files: groups.get(cat)! }));
}

interface PrTabProps {
  prs: PrInfo[];
  setPrs: (prs: PrInfo[]) => void;
  selectedPrNumber: number | null;
  onPrSelected: () => void;
}

type PrStateFilter = "all" | "open" | "closed" | "merged";

export function PrTab({
  prs,
  setPrs,
  selectedPrNumber,
  onPrSelected,
}: PrTabProps) {
  const { t } = useTranslation();
  const { repoPath } = useRepository();
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<PrStateFilter>("open");

  const [selectedPr, setSelectedPr] = useState<PrInfo | null>(null);
  const [diffs, setDiffs] = useState<CategorizedFileDiff[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set());
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const llmConfigRef = useRef<LlmConfig>({
    llm_endpoint: "",
    llm_model: "",
    llm_api_key_stored: false,
  });
  const automationConfigRef = useRef<AutomationConfig>({
    enabled: false,
    auto_approve_max_risk: "Low",
    enable_auto_merge: false,
    auto_merge_method: "Squash",
  });

  // Category accordion state (expanded categories)
  const [expandedCategories, setExpandedCategories] = useState<
    Set<ChangeCategory>
  >(new Set(["Logic"]));

  // Focus filter state
  const [focusCategoryFilters, setFocusCategoryFilters] = useState<
    Set<ChangeCategory>
  >(new Set());
  const [focusModuleFilter, setFocusModuleFilter] = useState<string | null>(
    null
  );

  // Analysis state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [hybridResult, setHybridResult] = useState<HybridAnalysisResult | null>(
    null
  );
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  // Per-PR analysis results cache (keyed by PR number)
  const analysisCache = useRef<
    Map<number, { analysis: AnalysisResult; hybrid?: HybridAnalysisResult }>
  >(new Map());

  // Commit list state
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState<string | null>(null);

  // View mode: "all" shows all PR files, "commit" shows per-commit diff
  const [viewMode, setViewMode] = useState<"all" | "commit">("all");
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [commitDiffs, setCommitDiffs] = useState<FileDiff[]>([]);
  const [commitDiffLoading, setCommitDiffLoading] = useState(false);
  const [commitDiffError, setCommitDiffError] = useState<string | null>(null);
  const [commitExpandedFiles, setCommitExpandedFiles] = useState<Set<number>>(
    new Set()
  );

  // Background risk analysis state
  const [analyzingPrs, setAnalyzingPrs] = useState<Set<number>>(new Set());
  // Counter to force re-render when analysisCache is updated in background
  const [, setCacheVersion] = useState(0);

  // Review state
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmingReview, setConfirmingReview] = useState<ReviewEvent | null>(
    null
  );

  useEffect(() => {
    invoke("load_app_config")
      .then((config) => {
        if (config.github_token) setToken(config.github_token);
        if (config.default_owner) setOwner(config.default_owner);
        if (config.default_repo) setRepo(config.default_repo);
        llmConfigRef.current = config.llm;
        automationConfigRef.current = config.automation;
      })
      .catch(() => {
        // 設定ファイルが読み込めない場合は無視する
      });
  }, []);

  // バックグラウンドで全PRのリスク分析を実行する（同時実行数制限付き）
  const runBackgroundAnalysis = useCallback(
    async (
      prList: PrInfo[],
      ownerVal: string,
      repoVal: string,
      tokenVal: string
    ) => {
      const CONCURRENCY = 3;
      const queue = prList.filter(
        (pr) => !analysisCache.current.has(pr.number)
      );
      if (queue.length === 0) return;

      let index = 0;
      async function processNext() {
        while (index < queue.length) {
          const pr = queue[index++];
          setAnalyzingPrs((prev) => new Set(prev).add(pr.number));
          try {
            const result = await invoke("analyze_pr_risk", {
              owner: ownerVal,
              repo: repoVal,
              prNumber: pr.number,
              token: tokenVal,
            });
            analysisCache.current.set(pr.number, { analysis: result });
            setCacheVersion((v) => v + 1);
          } catch {
            // 個別のPR分析失敗は無視して次へ進む
          } finally {
            setAnalyzingPrs((prev) => {
              const next = new Set(prev);
              next.delete(pr.number);
              return next;
            });
          }
        }
      }

      const workers = Array.from(
        { length: Math.min(CONCURRENCY, queue.length) },
        () => processNext()
      );
      await Promise.all(workers);
    },
    []
  );

  // バッジクリックによるPR自動選択
  useEffect(() => {
    if (selectedPrNumber === null) return;
    const pr = prs.find((p) => p.number === selectedPrNumber);
    if (pr) {
      handleSelectPr(pr);
      onPrSelected();
    }
  }, [selectedPrNumber, prs]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLoad(e?: FormEvent) {
    e?.preventDefault();
    if (!owner.trim() || !repo.trim() || !token.trim()) {
      setFormError(t("pr.fillAllFields"));
      return;
    }

    setFormError(null);
    setError(null);
    setLoading(true);
    setSelectedPr(null);
    setDiffs([]);
    setExpandedFiles(new Set());
    try {
      const result = await invoke("list_pull_requests", {
        owner: owner.trim(),
        repo: repo.trim(),
        token: token.trim(),
      });
      setPrs(result);
      // バックグラウンドで全PRのリスク分析を開始
      runBackgroundAnalysis(result, owner.trim(), repo.trim(), token.trim());
      // 成功時に設定を自動保存
      invoke("save_app_config", {
        config: {
          github_token: token.trim(),
          default_owner: owner.trim(),
          default_repo: repo.trim(),
          llm: llmConfigRef.current,
          automation: automationConfigRef.current,
        },
      }).catch(() => {
        // 設定の保存に失敗しても PR 取得結果は表示する
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPr(pr: PrInfo) {
    setSelectedPr(pr);
    setDiffError(null);
    setDiffLoading(true);
    setDiffs([]);
    setExpandedFiles(new Set());
    setExpandedCategories(new Set(["Logic"]));
    setFocusCategoryFilters(new Set());
    setFocusModuleFilter(null);
    setAnalysisError(null);
    setReviewComment("");
    setReviewMessage(null);
    setConfirmingReview(null);
    // Reset commit state
    setCommits([]);
    setCommitsError(null);
    setViewMode("all");
    setSelectedCommit(null);
    setCommitDiffs([]);
    setCommitDiffError(null);
    setCommitExpandedFiles(new Set());
    // Load cached analysis if available
    const cached = analysisCache.current.get(pr.number);
    if (cached) {
      setAnalysisResult(cached.analysis);
      setHybridResult(cached.hybrid ?? null);
    } else {
      setAnalysisResult(null);
      setHybridResult(null);
    }
    // Fetch PR files and commits in parallel
    const filesPromise = invoke("get_pull_request_files", {
      owner: owner.trim(),
      repo: repo.trim(),
      prNumber: pr.number,
      token: token.trim(),
    });
    setCommitsLoading(true);
    const commitsPromise = invoke("list_pr_commits", {
      owner: owner.trim(),
      repo: repo.trim(),
      prNumber: pr.number,
      token: token.trim(),
    });
    try {
      const result = await filesPromise;
      setDiffs(result);
    } catch (err) {
      setDiffError(String(err));
    } finally {
      setDiffLoading(false);
    }
    try {
      const commitResult = await commitsPromise;
      setCommits(commitResult);
    } catch (err) {
      setCommitsError(String(err));
    } finally {
      setCommitsLoading(false);
    }
  }

  function toggleFile(index: number) {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function expandAllFiles() {
    setExpandedFiles(new Set(diffs.map((_, i) => i)));
  }

  function collapseAllFiles() {
    setExpandedFiles(new Set());
  }

  async function handleSelectCommit(commit: CommitInfo) {
    setSelectedCommit(commit);
    setCommitDiffError(null);
    setCommitDiffLoading(true);
    setCommitDiffs([]);
    setCommitExpandedFiles(new Set());
    if (!repoPath) {
      setCommitDiffError("No repository selected");
      setCommitDiffLoading(false);
      return;
    }
    try {
      const result = await invoke("diff_commit", {
        repoPath,
        commitSha: commit.sha,
      });
      setCommitDiffs(result);
    } catch (err) {
      setCommitDiffError(String(err));
    } finally {
      setCommitDiffLoading(false);
    }
  }

  function toggleCommitFile(index: number) {
    setCommitExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function expandAllCommitFiles() {
    setCommitExpandedFiles(new Set(commitDiffs.map((_, i) => i)));
  }

  function collapseAllCommitFiles() {
    setCommitExpandedFiles(new Set());
  }

  function handleBackToList() {
    setSelectedPr(null);
    setDiffs([]);
    setExpandedFiles(new Set());
    setDiffError(null);
    setFocusCategoryFilters(new Set());
    setFocusModuleFilter(null);
    setAnalysisResult(null);
    setHybridResult(null);
    setAnalysisError(null);
    setReviewComment("");
    setReviewMessage(null);
    setConfirmingReview(null);
    setCommits([]);
    setCommitsError(null);
    setViewMode("all");
    setSelectedCommit(null);
    setCommitDiffs([]);
    setCommitDiffError(null);
    setCommitExpandedFiles(new Set());
  }

  async function handleAnalyze(pr: PrInfo) {
    // Check cache first
    const cached = analysisCache.current.get(pr.number);
    if (cached) {
      setAnalysisResult(cached.analysis);
      setHybridResult(cached.hybrid ?? null);
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setHybridResult(null);
    try {
      const result = await invoke("analyze_pr_risk", {
        owner: owner.trim(),
        repo: repo.trim(),
        prNumber: pr.number,
        token: token.trim(),
      });
      setAnalysisResult(result);
      analysisCache.current.set(pr.number, { analysis: result });

      // Try LLM analysis if API key is stored
      if (llmConfigRef.current.llm_api_key_stored) {
        try {
          const hybrid = await invoke("analyze_pr_risk_with_llm", {
            owner: owner.trim(),
            repo: repo.trim(),
            prNumber: pr.number,
            token: token.trim(),
          });
          setHybridResult(hybrid);
          setAnalysisResult(hybrid.static_analysis);
          analysisCache.current.set(pr.number, {
            analysis: hybrid.static_analysis,
            hybrid,
          });
        } catch {
          // LLM analysis is optional; static analysis result is already set
        }
      }
    } catch (err) {
      setAnalysisError(String(err));
    } finally {
      setAnalysisLoading(false);
    }
  }

  function toggleCategory(category: ChangeCategory) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  async function handleSubmitReview(event: ReviewEvent) {
    if (!selectedPr) return;
    if (event === "REQUEST_CHANGES" && !reviewComment.trim()) {
      setReviewMessage({ type: "error", text: t("pr.reviewCommentRequired") });
      return;
    }
    setReviewLoading(true);
    setReviewMessage(null);
    setConfirmingReview(null);
    try {
      await invoke("submit_pr_review", {
        owner: owner.trim(),
        repo: repo.trim(),
        prNumber: selectedPr.number,
        event,
        body: reviewComment.trim(),
        token: token.trim(),
      });
      setReviewMessage({ type: "success", text: t("pr.reviewSuccess") });
      setReviewComment("");
    } catch (err) {
      setReviewMessage({
        type: "error",
        text: `${t("pr.reviewError")}: ${err}`,
      });
    } finally {
      setReviewLoading(false);
    }
  }

  const filteredPrs =
    stateFilter === "all" ? prs : prs.filter((pr) => pr.state === stateFilter);

  function toggleFocusCategory(category: ChangeCategory) {
    setFocusCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function resetFocusFilters() {
    setFocusCategoryFilters(new Set());
    setFocusModuleFilter(null);
  }

  const isFocusActive =
    focusCategoryFilters.size > 0 || focusModuleFilter !== null;

  // Get affected modules from LLM analysis for module filter
  const affectedModules: AffectedModule[] =
    hybridResult?.llm_analysis.affected_modules ?? [];

  // Apply focus filters to diffs
  const filteredDiffs = isFocusActive
    ? diffs.filter((diff) => {
        const categoryMatch =
          focusCategoryFilters.size === 0 ||
          focusCategoryFilters.has(diff.category);
        const moduleMatch =
          focusModuleFilter === null ||
          affectedModules.some(
            (m) =>
              m.name === focusModuleFilter &&
              (diff.new_path ?? diff.old_path ?? "").includes(focusModuleFilter)
          );
        return categoryMatch && moduleMatch;
      })
    : diffs;

  const groupedDiffs = groupByCategory(filteredDiffs);

  // PR diff view
  if (selectedPr) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Button onClick={handleBackToList}>{t("pr.backToList")}</Button>
          <span className="font-mono text-[0.8rem] font-semibold text-info">
            #{selectedPr.number}
          </span>
          <span className="text-[0.9rem] font-medium text-text-primary">
            {selectedPr.title}
          </span>
          <Badge variant={stateVariant(selectedPr.state)}>
            {selectedPr.state}
          </Badge>
          {analysisResult && (
            <RiskBadge
              level={
                hybridResult?.combined_risk_level ?? analysisResult.risk.level
              }
            />
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleAnalyze(selectedPr)}
            disabled={analysisLoading}
            className="ml-auto"
          >
            {analysisLoading ? t("pr.analyzing") : t("pr.analyze")}
          </Button>
        </div>
        <ChangeSummaryList
          owner={owner.trim()}
          repo={repo.trim()}
          prNumber={selectedPr.number}
          token={token.trim()}
          diffs={diffs}
        />
        <ConsistencyCheckPanel
          owner={owner.trim()}
          repo={repo.trim()}
          prNumber={selectedPr.number}
          token={token.trim()}
        />
        {/* Review action section */}
        <Card className="mt-4">
          <h2 className="mb-3 border-b border-border pb-2 text-lg text-text-heading">
            Review
          </h2>
          <textarea
            className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-[0.85rem] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            rows={3}
            placeholder={t("pr.reviewComment")}
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            disabled={reviewLoading}
          />
          <div className="mt-3 flex items-center gap-2">
            {confirmingReview === null ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setConfirmingReview("APPROVE")}
                  disabled={reviewLoading || selectedPr.state !== "open"}
                >
                  {t("pr.approve")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmingReview("REQUEST_CHANGES")}
                  disabled={reviewLoading || selectedPr.state !== "open"}
                >
                  {t("pr.requestChanges")}
                </Button>
              </>
            ) : (
              <>
                <span className="text-[0.85rem] text-text-secondary">
                  {confirmingReview === "APPROVE"
                    ? t("pr.confirmApprove")
                    : t("pr.confirmRequestChanges")}
                </span>
                <Button
                  variant={
                    confirmingReview === "APPROVE" ? "primary" : "destructive"
                  }
                  size="sm"
                  onClick={() => handleSubmitReview(confirmingReview)}
                  disabled={reviewLoading}
                >
                  {reviewLoading
                    ? t("pr.reviewSubmitting")
                    : t("common.confirm")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmingReview(null)}
                  disabled={reviewLoading}
                >
                  {t("common.cancel")}
                </Button>
              </>
            )}
          </div>
          {reviewMessage && (
            <p
              className={`mt-2 text-[0.85rem] ${reviewMessage.type === "success" ? "text-accent" : "text-danger"}`}
            >
              {reviewMessage.text}
            </p>
          )}
        </Card>
        {/* Commit list panel */}
        <Card className="mt-4">
          <h2 className="mb-3 border-b border-border pb-2 text-lg text-text-heading">
            {t("pr.commits")}
          </h2>
          {commitsLoading && <Loading />}
          {commitsError && (
            <p className="p-2 text-[0.9rem] text-danger">
              {t("pr.commitsError")}: {commitsError}
            </p>
          )}
          {!commitsLoading && !commitsError && commits.length === 0 && (
            <p className="p-2 text-[0.9rem] italic text-text-secondary">
              {t("pr.commitsEmpty")}
            </p>
          )}
          {commits.length > 0 && (
            <div className="scrollbar-custom max-h-60 overflow-y-auto">
              {commits.map((commit) => {
                const isSelected = selectedCommit?.sha === commit.sha;
                return (
                  <div
                    key={commit.sha}
                    className={`cursor-pointer border-b border-border px-3 py-2 transition-colors last:border-b-0 hover:bg-bg-hover ${
                      isSelected ? "bg-bg-hover" : ""
                    }`}
                    onClick={() => {
                      if (viewMode === "all") setViewMode("commit");
                      handleSelectCommit(commit);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 font-mono text-[0.75rem] text-info">
                        {commit.sha.slice(0, 7)}
                      </span>
                      <span className="truncate text-[0.8rem] text-text-primary">
                        {commit.message.split("\n")[0]}
                      </span>
                    </div>
                    <div className="mt-0.5 flex gap-3 text-[0.7rem] text-text-secondary">
                      <span>@{commit.author}</span>
                      <span>{commit.date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card className="mt-4">
          <div className="mb-4 flex items-center gap-3 border-b border-border pb-2">
            <h2 className="text-lg text-text-heading">
              {t("diff.changedFiles")}
            </h2>
            {/* View toggle */}
            <div className="flex gap-1">
              <button
                className={`rounded-md px-3 py-1 text-[0.8rem] font-medium transition-colors ${
                  viewMode === "all"
                    ? "bg-accent text-white"
                    : "bg-bg-primary text-text-secondary hover:bg-bg-hover"
                }`}
                onClick={() => setViewMode("all")}
              >
                {t("pr.viewAllFiles")}
              </button>
              <button
                className={`rounded-md px-3 py-1 text-[0.8rem] font-medium transition-colors ${
                  viewMode === "commit"
                    ? "bg-accent text-white"
                    : "bg-bg-primary text-text-secondary hover:bg-bg-hover"
                }`}
                onClick={() => setViewMode("commit")}
              >
                {t("pr.viewByCommit")}
              </button>
            </div>
            {viewMode === "all" && isFocusActive && (
              <span className="text-[0.8rem] text-text-secondary">
                {t("pr.focusFilterActive", {
                  current: filteredDiffs.length,
                  total: diffs.length,
                })}
              </span>
            )}
            {viewMode === "all" && diffs.length > 0 && (
              <div className="ml-auto flex gap-2">
                <Button variant="secondary" size="sm" onClick={expandAllFiles}>
                  {t("pr.expandAll")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={collapseAllFiles}
                >
                  {t("pr.collapseAll")}
                </Button>
              </div>
            )}
            {viewMode === "commit" && commitDiffs.length > 0 && (
              <div className="ml-auto flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={expandAllCommitFiles}
                >
                  {t("pr.expandAll")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={collapseAllCommitFiles}
                >
                  {t("pr.collapseAll")}
                </Button>
              </div>
            )}
          </div>
          {/* All files view */}
          {viewMode === "all" && (
            <>
              {/* Focus filter bar */}
              {diffs.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {categoryOrder
                    .filter((cat) => diffs.some((d) => d.category === cat))
                    .map((cat) => {
                      const isSelected = focusCategoryFilters.has(cat);
                      return (
                        <button
                          key={cat}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium transition-colors ${
                            isSelected
                              ? "bg-accent text-white"
                              : "bg-bg-primary text-text-secondary hover:bg-bg-hover"
                          }`}
                          onClick={() => toggleFocusCategory(cat)}
                        >
                          <span>{categoryIcons[cat]}</span>
                          <span>{t(categoryLabelKeys[cat])}</span>
                        </button>
                      );
                    })}
                  {affectedModules.length > 0 && (
                    <>
                      <span className="text-[0.7rem] text-text-muted">|</span>
                      <span className="text-[0.7rem] text-text-muted">
                        {t("pr.focusModuleFilter")}:
                      </span>
                      {affectedModules.map((mod) => {
                        const isSelected = focusModuleFilter === mod.name;
                        return (
                          <button
                            key={mod.name}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium transition-colors ${
                              isSelected
                                ? "bg-accent text-white"
                                : "bg-bg-primary text-text-secondary hover:bg-bg-hover"
                            }`}
                            onClick={() =>
                              setFocusModuleFilter(isSelected ? null : mod.name)
                            }
                            title={mod.description}
                          >
                            {mod.name}
                          </button>
                        );
                      })}
                    </>
                  )}
                  {isFocusActive && (
                    <button
                      className="ml-1 rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium text-danger transition-colors hover:bg-bg-hover"
                      onClick={resetFocusFilters}
                    >
                      {t("pr.focusFilterReset")}
                    </button>
                  )}
                </div>
              )}
              <div className="scrollbar-custom overflow-y-auto">
                {diffLoading && <Loading />}
                {diffError && (
                  <p className="p-2 text-[0.9rem] text-danger">
                    {t("common.error", { message: diffError })}
                  </p>
                )}
                {!diffLoading && !diffError && diffs.length === 0 && (
                  <p className="p-2 text-[0.9rem] italic text-text-secondary">
                    {t("pr.noDiffFiles")}
                  </p>
                )}
                {groupedDiffs.map((group) => {
                  const isCategoryExpanded = expandedCategories.has(
                    group.category
                  );
                  return (
                    <div key={group.category}>
                      <button
                        className="flex w-full cursor-pointer items-center gap-2 border-b border-border bg-bg-primary px-3 py-2 text-left text-[0.8rem] font-semibold text-text-heading transition-colors hover:bg-bg-hover"
                        onClick={() => toggleCategory(group.category)}
                      >
                        <span className="text-[0.7rem]">
                          {isCategoryExpanded ? "\u25BC" : "\u25B6"}
                        </span>
                        <span>{categoryIcons[group.category]}</span>
                        <span>{t(categoryLabelKeys[group.category])}</span>
                        <span className="ml-auto text-[0.75rem] font-normal text-text-secondary">
                          {group.files.length}
                        </span>
                      </button>
                      {isCategoryExpanded &&
                        group.files.map(({ diff, originalIndex }) => {
                          const isFileExpanded =
                            expandedFiles.has(originalIndex);
                          return (
                            <div
                              key={
                                diff.new_path ?? diff.old_path ?? originalIndex
                              }
                            >
                              <div
                                className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 pl-7 font-mono text-[0.8rem] transition-colors hover:bg-bg-primary"
                                onClick={() => toggleFile(originalIndex)}
                              >
                                <span className="text-[0.65rem] text-text-secondary">
                                  {isFileExpanded ? "\u25BC" : "\u25B6"}
                                </span>
                                <Badge variant={statusVariant(diff.status)}>
                                  {statusLabel(diff.status)}
                                </Badge>
                                <span
                                  className="truncate text-text-primary"
                                  title={diff.new_path ?? diff.old_path ?? ""}
                                >
                                  {diff.new_path ??
                                    diff.old_path ??
                                    "(unknown)"}
                                </span>
                              </div>
                              {isFileExpanded && (
                                <div className="border-b border-border bg-bg-secondary font-mono text-[0.8rem] leading-relaxed">
                                  {diff.chunks.length === 0 && (
                                    <p className="p-2 text-[0.9rem] italic text-text-secondary">
                                      {t("diff.noDiffContent")}
                                    </p>
                                  )}
                                  {diff.chunks.map((chunk, ci) => (
                                    <div key={ci}>
                                      <div className="border-y border-border bg-diff-header-bg px-3 py-1 text-xs text-info">
                                        {chunk.header}
                                      </div>
                                      {chunk.lines.map((line, li) => {
                                        const origin = getOriginString(
                                          line.origin
                                        );
                                        const lineClass =
                                          origin === "Addition"
                                            ? "diff-line-addition"
                                            : origin === "Deletion"
                                              ? "diff-line-deletion"
                                              : "";
                                        const prefix =
                                          origin === "Addition"
                                            ? "+"
                                            : origin === "Deletion"
                                              ? "-"
                                              : " ";
                                        const textColor =
                                          origin === "Addition"
                                            ? "text-accent"
                                            : origin === "Deletion"
                                              ? "text-danger"
                                              : "text-text-secondary";
                                        return (
                                          <div
                                            key={li}
                                            className={`flex whitespace-pre ${lineClass}`}
                                          >
                                            <span className="inline-block min-w-[3.5em] shrink-0 select-none px-2 text-right text-text-muted">
                                              {line.old_lineno ?? ""}
                                            </span>
                                            <span className="inline-block min-w-[3.5em] shrink-0 select-none px-2 text-right text-text-muted">
                                              {line.new_lineno ?? ""}
                                            </span>
                                            <span
                                              className={`flex-1 px-2 ${textColor}`}
                                            >
                                              {prefix}
                                              {line.content}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {/* Commit-specific diff view */}
          {viewMode === "commit" && (
            <div className="scrollbar-custom overflow-y-auto">
              {!selectedCommit && (
                <p className="p-2 text-[0.9rem] italic text-text-secondary">
                  {t("pr.selectCommit")}
                </p>
              )}
              {selectedCommit && (
                <>
                  <div className="mb-3 rounded-md border border-border bg-bg-primary px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[0.75rem] text-info">
                        {selectedCommit.sha.slice(0, 7)}
                      </span>
                      <span className="text-[0.85rem] font-medium text-text-primary">
                        {selectedCommit.message.split("\n")[0]}
                      </span>
                    </div>
                    <div className="mt-1 text-[0.7rem] text-text-secondary">
                      @{selectedCommit.author} · {selectedCommit.date}
                    </div>
                  </div>
                  {commitDiffLoading && <Loading />}
                  {commitDiffError && (
                    <p className="p-2 text-[0.9rem] text-danger">
                      {t("pr.commitDiffError")}: {commitDiffError}
                    </p>
                  )}
                  {!commitDiffLoading &&
                    !commitDiffError &&
                    commitDiffs.length === 0 && (
                      <p className="p-2 text-[0.9rem] italic text-text-secondary">
                        {t("pr.commitDiffEmpty")}
                      </p>
                    )}
                  {commitDiffs.map((diff, fileIndex) => {
                    const isFileExpanded = commitExpandedFiles.has(fileIndex);
                    return (
                      <div key={diff.new_path ?? diff.old_path ?? fileIndex}>
                        <div
                          className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 font-mono text-[0.8rem] transition-colors hover:bg-bg-primary"
                          onClick={() => toggleCommitFile(fileIndex)}
                        >
                          <span className="text-[0.65rem] text-text-secondary">
                            {isFileExpanded ? "\u25BC" : "\u25B6"}
                          </span>
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
                        {isFileExpanded && (
                          <div className="border-b border-border bg-bg-secondary font-mono text-[0.8rem] leading-relaxed">
                            {diff.chunks.length === 0 && (
                              <p className="p-2 text-[0.9rem] italic text-text-secondary">
                                {t("diff.noDiffContent")}
                              </p>
                            )}
                            {diff.chunks.map((chunk, ci) => (
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
                                    origin === "Addition"
                                      ? "+"
                                      : origin === "Deletion"
                                        ? "-"
                                        : " ";
                                  const textColor =
                                    origin === "Addition"
                                      ? "text-accent"
                                      : origin === "Deletion"
                                        ? "text-danger"
                                        : "text-text-secondary";
                                  return (
                                    <div
                                      key={li}
                                      className={`flex whitespace-pre ${lineClass}`}
                                    >
                                      <span className="inline-block min-w-[3.5em] shrink-0 select-none px-2 text-right text-text-muted">
                                        {line.old_lineno ?? ""}
                                      </span>
                                      <span className="inline-block min-w-[3.5em] shrink-0 select-none px-2 text-right text-text-muted">
                                        {line.new_lineno ?? ""}
                                      </span>
                                      <span
                                        className={`flex-1 px-2 ${textColor}`}
                                      >
                                        {prefix}
                                        {line.content}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </Card>
        {/* Analysis section */}
        {analysisLoading && <Loading className="mt-4" />}
        {analysisError && (
          <p className="mt-4 text-[0.9rem] text-danger">
            {t("common.error", { message: analysisError })}
          </p>
        )}
        {analysisResult && !analysisLoading && (
          <AnalysisDetailPanel
            result={analysisResult}
            hybridResult={hybridResult ?? undefined}
          />
        )}
      </div>
    );
  }

  // PR list view
  return (
    <div>
      <section className="flex flex-col rounded-lg border border-border bg-bg-secondary p-5">
        <h2 className="mb-4 border-b border-border pb-2 text-lg text-text-heading">
          {t("pr.title")}
        </h2>
        <div>
          <div className="mb-2 flex items-end gap-3">
            <div className="mb-0 flex-1">
              <Input
                id="pr-owner"
                label={t("pr.owner")}
                placeholder="owner"
                required
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
            <div className="mb-0 flex-1">
              <Input
                id="pr-repo"
                label={t("pr.repo")}
                placeholder="repo"
                required
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
            </div>
            <div className="mb-0 flex-1">
              <Input
                type="password"
                id="pr-token"
                label={t("pr.token")}
                placeholder="ghp_..."
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <Button
              className="shrink-0 self-end"
              onClick={() => handleLoad()}
              disabled={loading}
            >
              {t("pr.fetch")}
            </Button>
          </div>
          {formError && (
            <div className="mt-2 min-h-[1.2em] text-[0.8rem] text-danger">
              {formError}
            </div>
          )}
        </div>
        {prs.length > 0 && (
          <div className="mb-3 flex gap-1">
            {(["all", "open", "closed", "merged"] as const).map((filter) => (
              <button
                key={filter}
                className={`rounded-md px-3 py-1 text-[0.8rem] font-medium transition-colors ${
                  stateFilter === filter
                    ? "bg-accent text-white"
                    : "bg-bg-primary text-text-secondary hover:bg-bg-hover"
                }`}
                onClick={() => setStateFilter(filter)}
              >
                {t(
                  `pr.filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`
                )}
              </button>
            ))}
          </div>
        )}
        <div className="scrollbar-custom overflow-y-auto">
          {loading && <Loading />}
          {error && (
            <p className="p-2 text-[0.9rem] text-danger">
              {t("common.error", { message: error })}
            </p>
          )}
          {!loading && !error && prs.length === 0 && (
            <p className="p-2 text-[0.9rem] italic text-text-secondary">
              {t("pr.empty")}
            </p>
          )}
          {filteredPrs.map((pr) => (
            <div
              key={pr.number}
              className="cursor-pointer border-b border-border px-3 py-3 transition-colors last:border-b-0 hover:bg-bg-hover"
              onClick={() => handleSelectPr(pr)}
            >
              <div className="mb-1 flex items-center gap-2">
                <a
                  href={pr.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[0.8rem] font-semibold text-info hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  #{pr.number}
                </a>
                <span className="text-[0.9rem] font-medium text-text-primary">
                  {pr.title}
                </span>
                <Badge variant={stateVariant(pr.state)}>{pr.state}</Badge>
                {analysisCache.current.get(pr.number) ? (
                  <RiskBadge
                    level={
                      analysisCache.current.get(pr.number)!.hybrid
                        ?.combined_risk_level ??
                      analysisCache.current.get(pr.number)!.analysis.risk.level
                    }
                  />
                ) : analyzingPrs.has(pr.number) ? (
                  <Spinner size="sm" />
                ) : null}
              </div>
              <div className="mt-0.5 flex gap-4 text-xs text-text-secondary">
                <span>@{pr.author}</span>
                <span>
                  {pr.head_branch} → {pr.base_branch}
                </span>
                <span className="font-mono text-accent">+{pr.additions}</span>
                <span className="font-mono text-danger">-{pr.deletions}</span>
                <span className="font-mono">
                  {t("pr.files", { count: pr.changed_files })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
