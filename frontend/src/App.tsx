import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { WorktreeTab } from "./components/WorktreeTab";
import { BranchTab } from "./components/BranchTab";
import { DiffTab } from "./components/DiffTab";
import { PrTab } from "./components/PrTab";
import { TodoTab } from "./components/TodoTab";
import { LlmSettingsTab } from "./components/LlmSettingsTab";
import { AutomationSettingsTab } from "./components/AutomationSettingsTab";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Layout } from "./components/Layout";
import { RepositoryProvider } from "./RepositoryContext";
import { invoke } from "./invoke";
import type { RepositoryEntry, RepoInfo, PrInfo } from "./types";
import "./style.css";

const NAV_ITEMS = [
  { id: "worktree", labelKey: "tabs.worktrees", shortcut: "W" },
  { id: "branch", labelKey: "tabs.branches", shortcut: "B" },
  { id: "diff", labelKey: "tabs.diff", shortcut: "D" },
  { id: "pr", labelKey: "tabs.prs", shortcut: "P" },
  { id: "todo", labelKey: "tabs.todo", shortcut: "T" },
  { id: "settings", labelKey: "tabs.settings", shortcut: "S" },
] as const;

type TabName = (typeof NAV_ITEMS)[number]["id"];

export function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabName>("worktree");
  const [repositories, setRepositories] = useState<RepositoryEntry[]>([]);
  const [selectedRepoPath, setSelectedRepoPath] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [prs, setPrs] = useState<PrInfo[]>([]);
  const [selectedPrNumber, setSelectedPrNumber] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    resolve: (value: boolean) => void;
  } | null>(null);

  useEffect(() => {
    if (!selectedRepoPath) {
      setRepoInfo(null);
      return;
    }
    invoke("get_repo_info", { repoPath: selectedRepoPath })
      .then(setRepoInfo)
      .catch(() => setRepoInfo(null));
  }, [selectedRepoPath]);

  const loadRepositories = useCallback(async () => {
    try {
      const repos = await invoke("list_repositories");
      setRepositories(repos);
    } catch {
      // silently ignore — list may be empty on first run
    }
  }, []);

  useEffect(() => {
    loadRepositories();
  }, [loadRepositories]);

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

  const navigateToPr = useCallback((prNumber: number) => {
    setSelectedPrNumber(prNumber);
    setActiveTab("pr");
  }, []);

  const handleAddRepo = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    try {
      const entry = await invoke("add_repository", { path: selected });
      setRepositories((prev) => [...prev, entry]);
      setSelectedRepoPath(entry.path);
    } catch {
      // add_repository may fail if path is not a git repo
    }
  }, []);

  const handleRemoveRepo = useCallback(
    async (path: string) => {
      const repo = repositories.find((r) => r.path === path);
      const name = repo?.name ?? path;
      const confirmed = await showConfirm(
        t("repository.confirmRemove", { name })
      );
      if (!confirmed) return;
      try {
        await invoke("remove_repository", { path });
        setRepositories((prev) => prev.filter((r) => r.path !== path));
        if (selectedRepoPath === path) {
          setSelectedRepoPath(null);
        }
      } catch {
        // silently ignore
      }
    },
    [repositories, selectedRepoPath, showConfirm, t]
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
        case "t":
          setActiveTab("todo");
          break;
        case "s":
          setActiveTab("settings");
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
    <RepositoryProvider repoPath={selectedRepoPath} repoInfo={repoInfo}>
      <Layout
        repositories={repositories}
        selectedRepoPath={selectedRepoPath}
        onSelectRepo={setSelectedRepoPath}
        onAddRepo={handleAddRepo}
        onRemoveRepo={handleRemoveRepo}
        navItems={[...NAV_ITEMS]}
        activeTabId={activeTab}
        onSelectTab={(id) => setActiveTab(id as TabName)}
      >
        {activeTab === "worktree" && <WorktreeTab prs={prs} onNavigateToPr={navigateToPr} />}
        {activeTab === "branch" && <BranchTab showConfirm={showConfirm} prs={prs} onNavigateToPr={navigateToPr} />}
        {activeTab === "diff" && <DiffTab />}
        {activeTab === "pr" && <PrTab prs={prs} setPrs={setPrs} selectedPrNumber={selectedPrNumber} onPrSelected={() => setSelectedPrNumber(null)} />}
        {activeTab === "settings" && (
          <div className="mx-auto max-w-xl space-y-8">
            <LlmSettingsTab />
            <AutomationSettingsTab />
          </div>
        )}

        <ConfirmDialog
          open={confirmDialog !== null}
          message={confirmDialog?.message ?? ""}
          onConfirm={() => handleConfirm(true)}
          onCancel={() => handleConfirm(false)}
        />
      </Layout>
    </RepositoryProvider>
  );
}
