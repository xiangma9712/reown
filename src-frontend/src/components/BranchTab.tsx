import { useState, useEffect, FormEvent } from "react";
import { invoke } from "../invoke";
import type { BranchInfo } from "../types";

interface Props {
  showConfirm: (message: string) => Promise<boolean>;
}

export function BranchTab({ showConfirm }: Props) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [branchName, setBranchName] = useState("");
  const [formMessage, setFormMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadBranches() {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke("list_branches");
      setBranches(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBranches();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!branchName.trim()) return;

    setSubmitting(true);
    setFormMessage(null);
    try {
      await invoke("create_branch", { name: branchName.trim() });
      setFormMessage({
        text: `ブランチ '${branchName.trim()}' を作成しました。`,
        type: "success",
      });
      setBranchName("");
      await loadBranches();
    } catch (err) {
      setFormMessage({ text: `エラー: ${err}`, type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSwitch(name: string) {
    setFormMessage(null);
    try {
      await invoke("switch_branch", { name });
      setFormMessage({
        text: `ブランチ '${name}' に切り替えました。`,
        type: "success",
      });
      await loadBranches();
    } catch (err) {
      setFormMessage({ text: `エラー: ${err}`, type: "error" });
    }
  }

  async function handleDelete(name: string) {
    const confirmed = await showConfirm(
      `ブランチ '${name}' を削除しますか？この操作は取り消せません。`
    );
    if (!confirmed) return;

    setFormMessage(null);
    try {
      await invoke("delete_branch", { name });
      setFormMessage({
        text: `ブランチ '${name}' を削除しました。`,
        type: "success",
      });
      await loadBranches();
    } catch (err) {
      setFormMessage({ text: `エラー: ${err}`, type: "error" });
    }
  }

  return (
    <div className="tab-content active" id="tab-branch">
      <section className="panel" id="branch-panel">
        <h2>ブランチ</h2>
        <div className="list-container">
          {loading && <p className="loading">読み込み中…</p>}
          {error && <p className="error">エラー: {error}</p>}
          {!loading && !error && branches.length === 0 && (
            <p className="empty">ブランチがありません。</p>
          )}
          {branches.map((b) => (
            <div key={b.name} className="branch-item">
              <div className="branch-info">
                <div className={`branch-name${b.is_head ? " head" : ""}`}>
                  {b.is_head ? `* ${b.name}` : b.name}
                </div>
                {b.upstream && (
                  <div className="branch-upstream">upstream: {b.upstream}</div>
                )}
              </div>
              {!b.is_head && (
                <div className="branch-actions">
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => handleSwitch(b.name)}
                  >
                    切替
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => handleDelete(b.name)}
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="form-section">
          <h3>新規ブランチ作成</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="branch-name">ブランチ名</label>
              <input
                type="text"
                id="branch-name"
                placeholder="new-branch"
                required
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
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
