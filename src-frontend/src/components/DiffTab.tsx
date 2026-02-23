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
    <div className="tab-content active" id="tab-diff">
      <div className="diff-layout">
        <aside className="diff-file-list panel">
          <h2>変更ファイル</h2>
          <div className="list-container">
            {diffs.length === 0 && !loading && !error && (
              <p className="empty">Diffを読み込んでください。</p>
            )}
            {error && <p className="error">エラー: {error}</p>}
            {diffs.map((diff, index) => (
              <div
                key={diff.new_path ?? diff.old_path ?? index}
                className={`diff-file-item${selectedIndex === index ? " selected" : ""}`}
                onClick={() => setSelectedIndex(index)}
              >
                <span
                  className={`diff-file-status ${diff.status.toLowerCase()}`}
                >
                  {statusLabel(diff.status)}
                </span>
                <span
                  className="diff-file-name"
                  title={diff.new_path ?? diff.old_path ?? ""}
                >
                  {diff.new_path ?? diff.old_path ?? "(unknown)"}
                </span>
              </div>
            ))}
          </div>
          <div className="form-section">
            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={handleLoad}
              disabled={loading}
            >
              ワークディレクトリのDiffを読み込む
            </button>
          </div>
        </aside>
        <section className="diff-view panel">
          <h2>
            {selectedDiff
              ? selectedDiff.new_path ?? selectedDiff.old_path ?? "Diff"
              : "Diff"}
          </h2>
          <div className="diff-content">
            {!selectedDiff && (
              <p className="empty">
                左のファイル一覧からファイルを選択してください。
              </p>
            )}
            {selectedDiff && selectedDiff.chunks.length === 0 && (
              <p className="empty">
                差分内容がありません（バイナリファイルの可能性）。
              </p>
            )}
            {selectedDiff?.chunks.map((chunk, ci) => (
              <div key={ci}>
                <div className="diff-chunk-header">{chunk.header}</div>
                {chunk.lines.map((line, li) => {
                  const origin = getOriginString(line.origin);
                  const lineClass =
                    origin === "Addition"
                      ? "diff-line addition"
                      : origin === "Deletion"
                        ? "diff-line deletion"
                        : "diff-line context";
                  const prefix =
                    origin === "Addition"
                      ? "+"
                      : origin === "Deletion"
                        ? "-"
                        : " ";
                  return (
                    <div key={li} className={lineClass}>
                      <span className="diff-lineno">
                        {line.old_lineno ?? ""}
                      </span>
                      <span className="diff-lineno">
                        {line.new_lineno ?? ""}
                      </span>
                      <span className="diff-line-content">
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
