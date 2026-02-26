import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { ReviewTab } from "./components/ReviewTab";
import { TodoTab } from "./components/TodoTab";
import { BranchSelector } from "./components/BranchSelector";
import { LlmSettingsTab } from "./components/LlmSettingsTab";
import { AutomationSettingsTab } from "./components/AutomationSettingsTab";
import { Layout } from "./components/Layout";
import { RepositoryProvider } from "./RepositoryContext";
import { ThemeProvider } from "./ThemeContext";
import { invoke } from "./invoke";
import type { RepositoryEntry, RepoInfo, PrInfo } from "./types";
import "./style.css";

const NAV_ITEMS = [
  { id: "review", labelKey: "tabs.review", shortcut: "R" },
  { id: "next-action", labelKey: "tabs.nextAction", shortcut: "N" },
] as const;

type TabName = (typeof NAV_ITEMS)[number]["id"];

export function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabName>("review");
  const [repositories, setRepositories] = useState<RepositoryEntry[]>([]);
  const [selectedRepoPath, setSelectedRepoPath] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [prs] = useState<PrInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addingRepo, setAddingRepo] = useState(false);
  const [addRepoError, setAddRepoError] = useState<string | null>(null);
  const addErrorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!selectedRepoPath) {
      setRepoInfo(null);
      setSelectedBranch(null);
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

  const handleAddRepo = useCallback(async () => {
    setAddRepoError(null);
    clearTimeout(addErrorTimerRef.current);
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    setAddingRepo(true);
    try {
      const entry = await invoke("add_repository", { path: selected });
      setRepositories((prev) => [...prev, entry]);
      setSelectedRepoPath(entry.path);
    } catch {
      setAddRepoError(t("repository.addError"));
      addErrorTimerRef.current = setTimeout(() => setAddRepoError(null), 5000);
    } finally {
      setAddingRepo(false);
    }
  }, [t]);

  const dismissAddRepoError = useCallback(() => {
    setAddRepoError(null);
    clearTimeout(addErrorTimerRef.current);
  }, []);

  useEffect(() => {
    return () => clearTimeout(addErrorTimerRef.current);
  }, []);

  const handleRemoveRepo = useCallback(
    async (path: string) => {
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
    [selectedRepoPath]
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

      switch (e.key) {
        case "r":
          setActiveTab("review");
          setSettingsOpen(false);
          break;
        case "n":
          setActiveTab("next-action");
          setSettingsOpen(false);
          break;
        case "s":
          setSettingsOpen((prev) => !prev);
          break;
        case "Tab":
          e.preventDefault();
          setSettingsOpen(false);
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
  }, []);

  return (
    <ThemeProvider>
      <RepositoryProvider repoPath={selectedRepoPath} repoInfo={repoInfo}>
        <Layout
          repositories={repositories}
          selectedRepoPath={selectedRepoPath}
          onSelectRepo={setSelectedRepoPath}
          onAddRepo={handleAddRepo}
          onRemoveRepo={handleRemoveRepo}
          addingRepo={addingRepo}
          addRepoError={addRepoError}
          onDismissAddRepoError={dismissAddRepoError}
          navItems={[...NAV_ITEMS]}
          activeTabId={activeTab}
          onSelectTab={(id) => {
            setActiveTab(id as TabName);
            setSettingsOpen(false);
          }}
          settingsOpen={settingsOpen}
          onToggleSettings={() => setSettingsOpen((prev) => !prev)}
          branchSelector={
            <BranchSelector
              prs={prs}
              selectedBranch={selectedBranch}
              onSelectBranch={setSelectedBranch}
            />
          }
        >
          {settingsOpen ? (
            <div className="mx-auto max-w-xl space-y-8">
              <LlmSettingsTab />
              <AutomationSettingsTab />
            </div>
          ) : (
            <>
              {activeTab === "review" && (
                <ReviewTab selectedBranch={selectedBranch} prs={prs} />
              )}
              {activeTab === "next-action" && <TodoTab />}
            </>
          )}
        </Layout>
      </RepositoryProvider>
    </ThemeProvider>
  );
}
