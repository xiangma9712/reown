import { useState } from "react";
import { invoke } from "../invoke";
import type { FileDiff } from "../types";

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

function statusClass(status: string): string {
  switch (status) {
    case "Added":
      return "bg-status-added-bg text-accent";
    case "Deleted":
      return "bg-status-deleted-bg text-danger";
    case "Modified":
      return "bg-status-modified-bg text-warning";
    case "Renamed":
      return "bg-status-renamed-bg text-info";
    default:
      return "bg-btn-secondary text-text-secondary";
  }
}

function getOriginString(
  origin: "Addition" | "Deletion" | "Context" | { Other: string }
): string {
  if (typeof origin === "string") return origin;
  return "Other";
}

export function DiffTab() {
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoad() {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke("diff_workdir");
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
  }

  const selectedDiff = selectedIndex >= 0 ? diffs[selectedIndex] : null;

  return (
    <div>
      <div className="grid min-h-[500px] grid-cols-[280px_1fr] gap-4">
        <aside className="flex flex-col rounded-lg border border-border bg-bg-secondary p-5">
          <h2 className="mb-4 border-b border-border pb-2 text-lg text-white">
            変更ファイル
          </h2>
          <div className="scrollbar-custom flex-1 overflow-y-auto">
            {diffs.length === 0 && !loading && !error && (
              <p className="p-2 text-[0.9rem] italic text-text-secondary">
                Diffを読み込んでください。
              </p>
            )}
            {error && (
              <p className="p-2 text-[0.9rem] text-danger">エラー: {error}</p>
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
                <span
                  className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[0.7rem] font-semibold ${statusClass(diff.status)}`}
                >
                  {statusLabel(diff.status)}
                </span>
                <span
                  className="truncate text-text-primary"
                  title={diff.new_path ?? diff.old_path ?? ""}
                >
                  {diff.new_path ?? diff.old_path ?? "(unknown)"}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-4">
            <button
              className="w-full cursor-pointer rounded border-none bg-accent px-3 py-1.5 text-[0.8rem] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleLoad}
              disabled={loading}
            >
              ワークディレクトリのDiffを読み込む
            </button>
          </div>
        </aside>
        <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-bg-secondary p-5">
          <h2 className="mb-4 border-b border-border pb-2 text-lg text-white">
            {selectedDiff
              ? (selectedDiff.new_path ?? selectedDiff.old_path ?? "Diff")
              : "Diff"}
          </h2>
          <div className="scrollbar-custom flex-1 overflow-auto font-mono text-[0.8rem] leading-relaxed">
            {!selectedDiff && (
              <p className="p-2 text-[0.9rem] italic text-text-secondary">
                左のファイル一覧からファイルを選択してください。
              </p>
            )}
            {selectedDiff && selectedDiff.chunks.length === 0 && (
              <p className="p-2 text-[0.9rem] italic text-text-secondary">
                差分内容がありません（バイナリファイルの可能性）。
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
        </section>
      </div>
    </div>
  );
}
