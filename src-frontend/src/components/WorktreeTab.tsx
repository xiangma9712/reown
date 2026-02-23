import { useState, useEffect, FormEvent } from "react";
import { invoke } from "../invoke";
import type { WorktreeInfo } from "../types";

export function WorktreeTab() {
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const [wtPath, setWtPath] = useState("");
  const [wtBranch, setWtBranch] = useState("");
  const [formMessage, setFormMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadWorktrees() {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke("list_worktrees");
      setWorktrees(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorktrees();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!wtPath.trim() || !wtBranch.trim()) return;

    setSubmitting(true);
    setFormMessage(null);
    try {
      await invoke("add_worktree", {
        worktreePath: wtPath.trim(),
        branch: wtBranch.trim(),
      });
      setFormMessage({ text: "ワークツリーを作成しました。", type: "success" });
      setWtPath("");
      setWtBranch("");
      await loadWorktrees();
    } catch (err) {
      setFormMessage({ text: `エラー: ${err}`, type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tab-content active" id="tab-worktree">
      <section className="panel" id="worktree-panel">
        <h2>ワークツリー</h2>
        <div className="list-container">
          {loading && <p className="loading">読み込み中…</p>}
          {error && <p className="error">エラー: {error}</p>}
          {!loading && !error && worktrees.length === 0 && (
            <p className="empty">ワークツリーがありません。</p>
          )}
          {worktrees.map((wt, index) => (
            <div
              key={wt.path}
              className={`wt-item${selectedIndex === index ? " selected" : ""}`}
              onClick={() => setSelectedIndex(index)}
            >
              <span className={`wt-name${wt.is_main ? " main" : ""}`}>
                {wt.name}
              </span>
              {wt.is_locked && <span className="wt-badge locked">locked</span>}
              {!wt.branch && (
                <span className="wt-badge detached">detached</span>
              )}
              <div className="wt-detail">
                ブランチ: {wt.branch ?? "(detached)"}
              </div>
              <div className="wt-detail">パス: {wt.path}</div>
            </div>
          ))}
        </div>
        <div className="form-section">
          <h3>新規ワークツリー作成</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="wt-path">パス</label>
              <input
                type="text"
                id="wt-path"
                placeholder="/path/to/worktree"
                required
                value={wtPath}
                onChange={(e) => setWtPath(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="wt-branch">ブランチ名</label>
              <input
                type="text"
                id="wt-branch"
                placeholder="feature-branch"
                required
                value={wtBranch}
                onChange={(e) => setWtBranch(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              作成
            </button>
          </form>
          {formMessage && (
            <div className={`message ${formMessage.type}`}>
              {formMessage.text}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
