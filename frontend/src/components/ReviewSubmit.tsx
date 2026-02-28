import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "../invoke";
import type {
  PrInfo,
  ReviewEvent,
  AnalysisResult,
  CategorizedFileDiff,
  ChangeCategory,
} from "../types";
import { Button } from "./Button";
import { Card } from "./Card";

interface ReviewSubmitProps {
  matchedPr: PrInfo;
  owner: string;
  repo: string;
  analysisResult: AnalysisResult | null;
  prDiffs: CategorizedFileDiff[];
  comment?: string;
  onCommentChange?: (comment: string) => void;
}

export function ReviewSubmit({
  matchedPr,
  owner,
  repo,
  analysisResult,
  prDiffs,
  comment: externalComment,
  onCommentChange,
}: ReviewSubmitProps) {
  const { t } = useTranslation();
  const [internalComment, setInternalComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isControlled = externalComment !== undefined;
  const comment = isControlled ? externalComment : internalComment;
  const setComment = useCallback(
    (value: string) => {
      if (onCommentChange) {
        onCommentChange(value);
      }
      if (!isControlled) {
        setInternalComment(value);
      }
    },
    [isControlled, onCommentChange]
  );

  const clearMessages = useCallback(() => {
    setSuccessMessage(null);
    setErrorMessage(null);
  }, []);

  const handleSubmit = useCallback(
    async (event: ReviewEvent) => {
      if (event === "REQUEST_CHANGES" && !comment.trim()) {
        setErrorMessage(t("pr.reviewCommentRequired"));
        return;
      }

      const confirmMessage =
        event === "APPROVE"
          ? t("pr.confirmApprove")
          : t("pr.confirmRequestChanges");

      if (!window.confirm(confirmMessage)) return;

      setSubmitting(true);
      clearMessages();

      try {
        await invoke("submit_pr_review", {
          owner,
          repo,
          prNumber: matchedPr.number,
          event,
          body: comment,
        });

        // Record to review history
        const categories: ChangeCategory[] =
          prDiffs.length > 0
            ? [...new Set(prDiffs.map((d) => d.category))]
            : analysisResult
              ? analysisResult.summary.categories.map((c) => c.category)
              : [];

        await invoke("add_review_record", {
          record: {
            pr_number: matchedPr.number,
            repository: `${owner}/${repo}`,
            action: event,
            risk_level: analysisResult?.risk.level ?? "Low",
            timestamp: new Date().toISOString(),
            categories,
          },
        });

        setSuccessMessage(t("pr.reviewSuccess"));
        setComment("");
      } catch (err) {
        setErrorMessage(`${t("pr.reviewError")}: ${String(err)}`);
      } finally {
        setSubmitting(false);
      }
    },
    [
      comment,
      owner,
      repo,
      matchedPr.number,
      prDiffs,
      analysisResult,
      t,
      clearMessages,
      setComment,
    ]
  );

  return (
    <Card>
      <h3 className="mb-1 text-lg text-text-heading">
        {t("pr.reviewSubmitTitle")}
      </h3>
      <p className="mb-3 border-b border-border pb-2 text-sm text-text-secondary">
        #{matchedPr.number} {matchedPr.title}
      </p>

      {/* Feedback messages */}
      {successMessage && (
        <div className="mb-3 rounded border border-success-border bg-success-bg px-3 py-2 text-sm text-success">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-3 rounded border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
          {errorMessage}
        </div>
      )}

      {/* Submitting state */}
      {submitting && (
        <p className="mb-3 text-sm text-text-secondary">
          {t("pr.reviewSubmitting")}
        </p>
      )}

      {/* Comment textarea (always visible) */}
      <div className="mb-3 space-y-2">
        <label className="block text-sm text-text-secondary">
          {t("pr.reviewComment")}
        </label>
        <textarea
          className="w-full rounded border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={submitting}
          placeholder={t("pr.reviewCommentPlaceholder")}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="primary"
          disabled={submitting}
          onClick={() => {
            clearMessages();
            handleSubmit("APPROVE");
          }}
        >
          {t("pr.approve")}
        </Button>
        <Button
          variant="ghost"
          disabled={submitting || !comment.trim()}
          onClick={() => {
            clearMessages();
            handleSubmit("REQUEST_CHANGES");
          }}
        >
          {t("pr.requestChanges")}
        </Button>
      </div>
    </Card>
  );
}
