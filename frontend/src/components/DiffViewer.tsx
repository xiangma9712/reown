import { useTranslation } from "react-i18next";
import type { FileDiff, DiffChunk } from "../types";
import { Badge } from "./Badge";

interface DiffViewerProps {
  diff: FileDiff;
  className?: string;
}

const statusBadgeVariant: Record<
  FileDiff["status"],
  "success" | "danger" | "warning" | "info" | "default"
> = {
  Added: "success",
  Deleted: "danger",
  Modified: "warning",
  Renamed: "info",
  Other: "default",
};

function getOriginString(
  origin: "Addition" | "Deletion" | "Context" | { Other: string }
): string {
  if (typeof origin === "string") return origin;
  return "Other";
}

function ChunkView({ chunk }: { chunk: DiffChunk }) {
  return (
    <div>
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
            <span className="inline-block min-w-[3.5em] shrink-0 select-none border-r border-border px-2 text-right text-text-muted">
              {line.old_lineno ?? ""}
            </span>
            <span className="inline-block min-w-[3.5em] shrink-0 select-none border-r border-border px-2 text-right text-text-muted">
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
  );
}

function ChunkSeparator() {
  return (
    <div className="flex items-center gap-2 bg-bg-secondary px-3 py-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-text-muted">...</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function filePath(diff: FileDiff): string {
  return diff.new_path ?? diff.old_path ?? "";
}

export function DiffViewer({ diff, className = "" }: DiffViewerProps) {
  const { t } = useTranslation();
  const path = filePath(diff);

  return (
    <div
      className={`overflow-hidden rounded-lg border border-border ${className}`}
    >
      {/* File header */}
      <div className="flex items-center gap-2 border-b border-border bg-bg-secondary px-3 py-2">
        <Badge variant={statusBadgeVariant[diff.status]}>{diff.status}</Badge>
        <span className="truncate font-mono text-[0.8rem] font-semibold text-text-heading">
          {path}
        </span>
        {diff.status === "Renamed" && diff.old_path && (
          <span className="truncate text-[0.75rem] text-text-muted">
            ← {diff.old_path}
          </span>
        )}
      </div>

      {/* Diff content */}
      <div className="scrollbar-custom overflow-x-auto bg-bg-primary font-mono text-[0.8rem] leading-relaxed">
        {diff.chunks.length === 0 ? (
          <p className="p-3 text-[0.85rem] italic text-text-secondary">
            {t("diff.noDiffContent")}
          </p>
        ) : (
          diff.chunks.map((chunk, ci) => (
            <div key={ci}>
              {ci > 0 && <ChunkSeparator />}
              <ChunkView chunk={chunk} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
