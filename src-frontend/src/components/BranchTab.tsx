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
    <div>
      <section className="flex flex-col rounded-lg border border-border bg-bg-secondary p-5">
        <h2 className="mb-4 border-b border-border pb-2 text-lg text-white">
          ブランチ
        </h2>
        <div className="scrollbar-custom mb-4 min-h-[120px] max-h-[360px] flex-1 overflow-y-auto">
          {loading && (
            <p className="p-2 text-[0.9rem] text-text-secondary">読み込み中…</p>
          )}
          {error && (
            <p className="p-2 text-[0.9rem] text-danger">エラー: {error}</p>
          )}
          {!loading && !error && branches.length === 0 && (
            <p className="p-2 text-[0.9rem] italic text-text-secondary">
              ブランチがありません。
            </p>
          )}
          {branches.map((b) => (
            <div
              key={b.name}
              className="flex items-center justify-between border-b border-border px-3 py-2 font-mono text-[0.85rem] last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div
                  className={
                    b.is_head ? "font-bold text-accent" : "text-text-primary"
                  }
                >
                  {b.is_head ? `* ${b.name}` : b.name}
                </div>
                {b.upstream && (
                  <div className="mt-0.5 truncate text-xs text-text-secondary">
                    upstream: {b.upstream}
                  </div>
                )}
              </div>
              {!b.is_head && (
                <div className="ml-2 flex shrink-0 gap-1.5">
                  <button
                    className="cursor-pointer rounded border-none bg-btn-secondary px-2 py-1 text-xs text-text-primary transition-colors hover:bg-btn-secondary-hover"
                    onClick={() => handleSwitch(b.name)}
                  >
                    切替
                  </button>
                  <button
                    className="cursor-pointer rounded border-none bg-danger px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-danger-hover"
                    onClick={() => handleDelete(b.name)}
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-4">
          <h3 className="mb-3 text-[0.9rem] text-text-primary/80">
            新規ブランチ作成
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-2.5">
              <label
                htmlFor="branch-name"
                className="mb-0.5 block text-[0.8rem] text-text-secondary"
              >
                ブランチ名
              </label>
              <input
                type="text"
                id="branch-name"
                placeholder="new-branch"
                required
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full rounded border border-border-hover bg-bg-primary px-2.5 py-1.5 font-mono text-[0.85rem] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="cursor-pointer rounded border-none bg-accent px-3 py-1.5 text-[0.8rem] font-semibold text-bg-primary transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submitting}
            >
              作成
            </button>
          </form>
          {formMessage && (
            <div
              className={`mt-2 min-h-[1.2em] text-[0.8rem] ${formMessage.type === "success" ? "text-accent" : "text-danger"}`}
            >
              {formMessage.text}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
