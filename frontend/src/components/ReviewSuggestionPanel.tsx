import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import type { ReviewSuggestion, SuggestionSeverity } from "../types";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Spinner } from "./Loading";

interface ReviewSuggestionPanelProps {
  owner: string;
  repo: string;
  prNumber: number;
  token: string;
}

const severityBadgeVariant: Record<
  SuggestionSeverity,
  "info" | "warning" | "danger"
> = {
  Info: "info",
  Warning: "warning",
  Alert: "danger",
};

const severityBorderClass: Record<SuggestionSeverity, string> = {
  Info: "border-info/30 bg-status-renamed-bg",
  Warning: "border-warning/30 bg-status-modified-bg",
  Alert: "border-danger/30 bg-status-deleted-bg",
};

export function ReviewSuggestionPanel({
  owner,
  repo,
  prNumber,
  token,
}: ReviewSuggestionPanelProps) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<ReviewSuggestion[] | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setSuggestions(null);
    setError(null);
    setLoading(false);
    setCollapsed(false);
  }, [prNumber]);

  const handleSuggest = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuggestions(null);
    try {
      const result = await invoke("suggest_review_comments", {
        owner: owner.trim(),
        repo: repo.trim(),
        prNumber,
        token: token.trim(),
      });
      setSuggestions(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [owner, repo, prNumber, token]);

  return (
    <Card className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-2 text-lg text-text-heading"
          onClick={() => setCollapsed((prev) => !prev)}
        >
          <span className="text-[0.7rem]">{collapsed ? "\u25B6" : "\u25BC"}</span>
          {t("pr.reviewSuggestions")}
        </button>
        <Button
          variant={suggestions ? "secondary" : "primary"}
          size="sm"
          onClick={handleSuggest}
          disabled={loading}
        >
          {loading
            ? t("pr.reviewSuggestionsLoading")
            : t("pr.reviewSuggestionsRun")}
        </Button>
      </div>

      {!collapsed && (
        <>
          {loading && (
            <div className="flex items-center gap-2">
              <Spinner size="sm" />
              <span className="text-[0.85rem] text-text-secondary">
                {t("pr.reviewSuggestionsLoading")}
              </span>
            </div>
          )}

          {error && (
            <p className="text-[0.85rem] text-danger">
              {t("pr.reviewSuggestionsError")}: {error}
            </p>
          )}

          {suggestions && !loading && (
            <>
              {suggestions.length === 0 ? (
                <p className="text-[0.85rem] italic text-text-secondary">
                  {t("pr.reviewSuggestionsEmpty")}
                </p>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((suggestion, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded border px-3 py-2 text-[0.8rem] ${severityBorderClass[suggestion.severity]}`}
                    >
                      <Badge
                        variant={severityBadgeVariant[suggestion.severity]}
                        className="mt-0.5 shrink-0"
                      >
                        {t(`pr.severity${suggestion.severity}`)}
                      </Badge>
                      <div className="min-w-0">
                        <span className="text-text-primary">
                          {suggestion.message}
                        </span>
                        <span className="ml-2 text-[0.7rem] text-text-muted">
                          ({suggestion.source})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}
