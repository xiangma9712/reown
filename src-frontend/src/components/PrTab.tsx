import { useState, FormEvent } from "react";
import { invoke } from "../invoke";
import type { PrInfo } from "../types";

export function PrTab() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [prs, setPrs] = useState<PrInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleLoad(e?: FormEvent) {
    e?.preventDefault();
    if (!owner.trim() || !repo.trim() || !token.trim()) {
      setFormError("全てのフィールドを入力してください。");
      return;
    }

    setFormError(null);
    setError(null);
    setLoading(true);
    try {
      const result = await invoke("list_pull_requests", {
        owner: owner.trim(),
        repo: repo.trim(),
        token: token.trim(),
      });
      setPrs(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tab-content active" id="tab-pr">
      <section className="panel">
        <h2>Pull Requests</h2>
        <div
          className="form-section"
          style={{ borderTop: "none", paddingTop: 0 }}
        >
          <div className="pr-form-row">
            <div className="form-group">
              <label htmlFor="pr-owner">Owner</label>
              <input
                type="text"
                id="pr-owner"
                placeholder="owner"
                required
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="pr-repo">Repo</label>
              <input
                type="text"
                id="pr-repo"
                placeholder="repo"
                required
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="pr-token">Token</label>
              <input
                type="password"
                id="pr-token"
                placeholder="ghp_..."
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ alignSelf: "flex-end" }}
              onClick={() => handleLoad()}
              disabled={loading}
            >
              取得
            </button>
          </div>
          {formError && <div className="message error">{formError}</div>}
        </div>
        <div className="list-container" style={{ maxHeight: "none" }}>
          {loading && <p className="loading">読み込み中…</p>}
          {error && <p className="error">エラー: {error}</p>}
          {!loading && !error && prs.length === 0 && (
            <p className="empty">
              PR情報を取得するには上のフォームに入力してください。
            </p>
          )}
          {prs.map((pr) => (
            <div key={pr.number} className="pr-item">
              <div className="pr-item-header">
                <span className="pr-number">#{pr.number}</span>
                <span className="pr-title">{pr.title}</span>
                <span className={`pr-state ${pr.state}`}>{pr.state}</span>
              </div>
              <div className="pr-meta">
                <span>@{pr.author}</span>
                <span>{pr.head_branch}</span>
                <span className="pr-stat additions">+{pr.additions}</span>
                <span className="pr-stat deletions">-{pr.deletions}</span>
                <span className="pr-stat">{pr.changed_files} files</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
