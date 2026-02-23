import { useState, useCallback, useEffect } from "react";
import { WorktreeTab } from "./components/WorktreeTab";
import { BranchTab } from "./components/BranchTab";
import { DiffTab } from "./components/DiffTab";
import { PrTab } from "./components/PrTab";
import { ConfirmDialog } from "./components/ConfirmDialog";
import "./style.css";

const TAB_ORDER = ["worktree", "branch", "diff", "pr"] as const;
type TabName = (typeof TAB_ORDER)[number];

const TAB_LABELS: Record<TabName, { label: string; shortcut: string }> = {
  worktree: { label: "Worktrees", shortcut: "W" },
  branch: { label: "Branches", shortcut: "B" },
  diff: { label: "Diff", shortcut: "D" },
  pr: { label: "PRs", shortcut: "P" },
};

export function App() {
  const [activeTab, setActiveTab] = useState<TabName>("worktree");
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    resolve: (value: boolean) => void;
  } | null>(null);

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({ message, resolve });
    });
  }, []);

  const handleConfirm = useCallback(
    (result: boolean) => {
      confirmDialog?.resolve(result);
      setConfirmDialog(null);
    },
    [confirmDialog]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el) {
        const tag = el.tagName.toLowerCase();
        if (
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          (el as HTMLElement).isContentEditable
        ) {
          return;
        }
      }

      if (confirmDialog) return;

      switch (e.key) {
        case "w":
          setActiveTab("worktree");
          break;
        case "b":
          setActiveTab("branch");
          break;
        case "d":
          setActiveTab("diff");
          break;
        case "p":
          setActiveTab("pr");
          break;
        case "Tab":
          e.preventDefault();
          setActiveTab((prev) => {
            const idx = TAB_ORDER.indexOf(prev);
            return TAB_ORDER[(idx + 1) % TAB_ORDER.length];
          });
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmDialog]);

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <header className="mb-8 text-center">
        <h1 className="mb-1 text-3xl text-white">reown</h1>
        <p className="text-[0.95rem] text-text-secondary">
          エージェントPRの嵐の時代でも、コードベースを自分のものに。
        </p>
      </header>

      <nav className="mb-6 flex border-b border-border">
        {TAB_ORDER.map((tab) => (
          <button
            key={tab}
            className={`cursor-pointer border-b-2 border-transparent bg-transparent px-5 py-2.5 text-[0.9rem] text-text-secondary transition-colors duration-150 hover:text-text-primary ${
              activeTab === tab
                ? "!border-b-accent font-semibold !text-accent"
                : ""
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab].label}
            <span
              className={`ml-1.5 inline-block rounded-sm border border-border-hover bg-bg-hint px-1 align-middle text-[0.65rem] font-semibold leading-[1.4] text-text-muted ${
                activeTab === tab
                  ? "!border-accent !bg-accent/10 !text-accent"
                  : ""
              }`}
            >
              {TAB_LABELS[tab].shortcut}
            </span>
          </button>
        ))}
      </nav>

      {activeTab === "worktree" && <WorktreeTab />}
      {activeTab === "branch" && <BranchTab showConfirm={showConfirm} />}
      {activeTab === "diff" && <DiffTab />}
      {activeTab === "pr" && <PrTab />}

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={() => handleConfirm(true)}
          onCancel={() => handleConfirm(false)}
        />
      )}
    </div>
  );
}
