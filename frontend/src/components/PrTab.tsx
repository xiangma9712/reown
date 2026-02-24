import { useState, useEffect, useRef, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import type { PrInfo, FileDiff, CategorizedFileDiff, ChangeCategory, LlmConfig, AnalysisResult, HybridAnalysisResult } from "../types";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { Input } from "./Input";
import { Loading } from "./Loading";
import { RiskBadge } from "./RiskBadge";
import { AnalysisDetailPanel } from "./AnalysisDetailPanel";
import { AiSummaryPanel } from "./AiSummaryPanel";

function stateVariant(
  state: string,
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
  status: string,
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
  origin: "Addition" | "Deletion" | "Context" | { Other: string },
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
  "Logic", "Refactor", "Test", "Config", "Documentation", "CI", "Dependency", "Other",
];

function groupByCategory(diffs: CategorizedFileDiff[]): { category: ChangeCategory; files: { diff: CategorizedFileDiff; originalIndex: number }[] }[] {
  const groups = new Map<ChangeCategory, { diff: CategorizedFileDiff; originalIndex: number }[]>();
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
}

type PrStateFilter = "all" | "open" | "closed" | "merged";

export function PrTab({ prs, setPrs }: PrTabProps) {
  const { t } = useTranslation();
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<PrStateFilter>("open");

  const [selectedPr, setSelectedPr] = useState<PrInfo | null>(null);
  const [diffs, setDiffs] = useState<CategorizedFileDiff[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(-1);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const llmConfigRef = useRef<LlmConfig>({ llm_endpoint: "", llm_model: "", llm_api_key_stored: false });

  // Category accordion state (expanded categories)
  const [expandedCategories, setExpandedCategories] = useState<Set<ChangeCategory>>(new Set(["Logic"]));

  // Analysis state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [hybridResult, setHybridResult] = useState<HybridAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  // Per-PR analysis results cache (keyed by PR number)
  const analysisCache = useRef<Map<number, { analysis: AnalysisResult; hybrid?: HybridAnalysisResult }>>(new Map());

  useEffect(() => {
    invoke("load_app_config").then((config) => {
      if (config.github_token) setToken(config.github_token);
      if (config.default_owner) setOwner(config.default_owner);
      if (config.default_repo) setRepo(config.default_repo);
      llmConfigRef.current = config.llm;
    }).catch(() => {
      // 設定ファイルが読み込めない場合は無視する
    });
  }, []);

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
    setSelectedFileIndex(-1);
    try {
      const result = await invoke("list_pull_requests", {
        owner: owner.trim(),
        repo: repo.trim(),
        token: token.trim(),
      });
      setPrs(result);
      // 成功時に設定を自動保存
      invoke("save_app_config", {
        config: {
          github_token: token.trim(),
          default_owner: owner.trim(),
          default_repo: repo.trim(),
          llm: llmConfigRef.current,
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
    setSelectedFileIndex(-1);
    setExpandedCategories(new Set(["Logic"]));
    setAnalysisError(null);
    // Load cached analysis if available
    const cached = analysisCache.current.get(pr.number);
    if (cached) {
      setAnalysisResult(cached.analysis);
      setHybridResult(cached.hybrid ?? null);
    } else {
      setAnalysisResult(null);
      setHybridResult(null);
    }
    try {
      const result = await invoke("get_pull_request_files", {
        owner: owner.trim(),
        repo: repo.trim(),
        prNumber: pr.number,
        token: token.trim(),
      });
      setDiffs(result);
      if (result.length > 0) {
        setSelectedFileIndex(0);
      }
    } catch (err) {
      setDiffError(String(err));
    } finally {
      setDiffLoading(false);
    }
  }

  function handleBackToList() {
    setSelectedPr(null);
    setDiffs([]);
    setSelectedFileIndex(-1);
    setDiffError(null);
    setAnalysisResult(null);
    setHybridResult(null);
    setAnalysisError(null);
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

  const filteredPrs =
    stateFilter === "all"
      ? prs
      : prs.filter((pr) => pr.state === stateFilter);

  const groupedDiffs = groupByCategory(diffs);

  const selectedDiff =
    selectedFileIndex >= 0 ? diffs[selectedFileIndex] : null;

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
            <RiskBadge level={hybridResult?.combined_risk_level ?? analysisResult.risk.level} />
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
        <AiSummaryPanel
          owner={owner.trim()}
          repo={repo.trim()}
          prNumber={selectedPr.number}
          token={token.trim()}
        />
        <div className="mt-4 grid min-h-[500px] grid-cols-[280px_1fr] gap-4">
          <Card className="flex flex-col">
            <h2 className="mb-4 border-b border-border pb-2 text-lg text-text-heading">
              {t("diff.changedFiles")}
            </h2>
            <div className="scrollbar-custom flex-1 overflow-y-auto">
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
                const isExpanded = expandedCategories.has(group.category);
                return (
                  <div key={group.category}>
                    <button
                      className="flex w-full cursor-pointer items-center gap-2 border-b border-border bg-bg-primary px-3 py-2 text-left text-[0.8rem] font-semibold text-text-heading transition-colors hover:bg-bg-hover"
                      onClick={() => toggleCategory(group.category)}
                    >
                      <span className="text-[0.7rem]">{isExpanded ? "\u25BC" : "\u25B6"}</span>
                      <span>{categoryIcons[group.category]}</span>
                      <span>{t(categoryLabelKeys[group.category])}</span>
                      <span className="ml-auto text-[0.75rem] font-normal text-text-secondary">
                        {group.files.length}
                      </span>
                    </button>
                    {isExpanded &&
                      group.files.map(({ diff, originalIndex }) => (
                        <div
                          key={diff.new_path ?? diff.old_path ?? originalIndex}
                          className={`flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 pl-7 font-mono text-[0.8rem] transition-colors last:border-b-0 hover:bg-bg-primary ${
                            selectedFileIndex === originalIndex
                              ? "border-l-2 border-l-accent bg-bg-hover"
                              : ""
                          }`}
                          onClick={() => setSelectedFileIndex(originalIndex)}
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
                );
              })}
            </div>
          </Card>
          <Card className="flex flex-col overflow-hidden">
            <h2 className="mb-4 border-b border-border pb-2 text-lg text-text-heading">
              {selectedDiff
                ? (selectedDiff.new_path ?? selectedDiff.old_path ?? "Diff")
                : "Diff"}
            </h2>
            <div className="scrollbar-custom flex-1 overflow-auto font-mono text-[0.8rem] leading-relaxed">
              {!selectedDiff && (
                <p className="p-2 text-[0.9rem] italic text-text-secondary">
                  {t("diff.selectFile")}
                </p>
              )}
              {selectedDiff && selectedDiff.chunks.length === 0 && (
                <p className="p-2 text-[0.9rem] italic text-text-secondary">
                  {t("diff.noDiffContent")}
                </p>
              )}
              {selectedDiff?.chunks.map((chunk, ci) => (
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
                        <span className={`flex-1 px-2 ${textColor}`}>
                          {prefix}
                          {line.content}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </Card>
        </div>
        {/* Analysis section */}
        {analysisLoading && <Loading className="mt-4" />}
        {analysisError && (
          <p className="mt-4 text-[0.9rem] text-danger">
            {t("common.error", { message: analysisError })}
          </p>
        )}
        {analysisResult && !analysisLoading && (
          <AnalysisDetailPanel result={analysisResult} hybridResult={hybridResult ?? undefined} />
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
                {t(`pr.filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`)}
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
                {analysisCache.current.get(pr.number) && (
                  <RiskBadge
                    level={
                      analysisCache.current.get(pr.number)!.hybrid?.combined_risk_level ??
                      analysisCache.current.get(pr.number)!.analysis.risk.level
                    }
                  />
                )}
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
