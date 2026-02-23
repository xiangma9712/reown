import { useState, useCallback, useEffect } from "react";
import { WorktreeTab } from "./components/WorktreeTab";
import { BranchTab } from "./components/BranchTab";
import { DiffTab } from "./components/DiffTab";
import { PrTab } from "./components/PrTab";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Layout } from "./components/Layout";
import "./style.css";

const NAV_ITEMS = [
  { id: "worktree", labelKey: "tabs.worktrees", shortcut: "W" },
  { id: "branch", labelKey: "tabs.branches", shortcut: "B" },
  { id: "diff", labelKey: "tabs.diff", shortcut: "D" },
  { id: "pr", labelKey: "tabs.prs", shortcut: "P" },
] as const;

type TabName = (typeof NAV_ITEMS)[number]["id"];

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
            const ids = NAV_ITEMS.map((item) => item.id);
            const idx = ids.indexOf(prev);
            return ids[(idx + 1) % ids.length] as TabName;
          });
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmDialog]);

  return (
    <Layout
      navItems={[...NAV_ITEMS]}
      activeId={activeTab}
      onSelect={(id) => setActiveTab(id as TabName)}
    >
      {activeTab === "worktree" && <WorktreeTab />}
      {activeTab === "branch" && <BranchTab showConfirm={showConfirm} />}
      {activeTab === "diff" && <DiffTab />}
      {activeTab === "pr" && <PrTab />}

      <ConfirmDialog
        open={confirmDialog !== null}
        message={confirmDialog?.message ?? ""}
        onConfirm={() => handleConfirm(true)}
        onCancel={() => handleConfirm(false)}
      />
    </Layout>
  );
}
