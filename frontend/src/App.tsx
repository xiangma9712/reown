import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { ReviewTab } from "./components/ReviewTab";
import { TodoTab } from "./components/TodoTab";
import { GithubSettingsTab } from "./components/GithubSettingsTab";
import { LlmSettingsTab } from "./components/LlmSettingsTab";
import { AutomationSettingsTab } from "./components/AutomationSettingsTab";
import { ThemeSettingsTab } from "./components/ThemeSettingsTab";
import { KeyboardShortcutSettingsTab } from "./components/KeyboardShortcutSettingsTab";
import { Layout } from "./components/Layout";
import { Loading } from "./components/Loading";
import { OnboardingPlaceholder } from "./components/OnboardingPlaceholder";
import { RepositoryProvider } from "./RepositoryContext";
import { ThemeProvider } from "./ThemeContext";
import { invoke } from "./invoke";
import type { RepositoryEntry, RepoInfo, PrInfo, AppConfig } from "./types";
import "./style.css";

const NAV_ITEMS = [
  { id: "review", labelKey: "tabs.review", shortcut: "R" },
  { id: "next-action", labelKey: "tabs.nextAction", shortcut: "N" },
  { id: "automate", labelKey: "tabs.automate", shortcut: "A" },
] as const;

type TabName = (typeof NAV_ITEMS)[number]["id"];

export function App() {
  const { t } = useTranslation();
  const [onboardingNeeded, setOnboardingNeeded] = useState<boolean | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<TabName>("review");
  const [repositories, setRepositories] = useState<RepositoryEntry[]>([]);
  const [selectedRepoPath, setSelectedRepoPath] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [prs, setPrs] = useState<PrInfo[]>([]);
  const [loadingPrs, setLoadingPrs] = useState(false);
  const [navigateToBranch, setNavigateToBranch] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addingRepo, setAddingRepo] = useState(false);
  const [addRepoError, setAddRepoError] = useState<string | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const addErrorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useEffect(() => {
    invoke("check_onboarding_needed")
      .then((needed) => setOnboardingNeeded(needed))
      .catch(() => setOnboardingNeeded(false));
  }, []);

  useEffect(() => {
    invoke("load_app_config")
      .then((config: AppConfig) =>
        setShowKeyboardShortcuts(config.show_keyboard_shortcuts)
      )
      .catch(() => {});
  }, []);

  const handleSkipOnboarding = useCallback(async () => {
    try {
      await invoke("complete_onboarding");
    } catch {
      // continue even if save fails
    }
    setOnboardingNeeded(false);
  }, []);

  useEffect(() => {
    if (!selectedRepoPath) {
      setRepoInfo(null);
      return;
    }
    invoke("get_repo_info", { repoPath: selectedRepoPath })
      .then(setRepoInfo)
      .catch(() => setRepoInfo(null));
  }, [selectedRepoPath]);

  useEffect(() => {
    if (!repoInfo?.github_owner || !repoInfo?.github_repo) {
      setPrs([]);
      return;
    }
    const owner = repoInfo.github_owner;
    const repo = repoInfo.github_repo;
    let cancelled = false;

    (async () => {
      setLoadingPrs(true);
      try {
        const result = await invoke("list_pull_requests", {
          owner,
          repo,
        });
        if (!cancelled) {
          setPrs(result);
        }
      } catch {
        if (!cancelled) {
          setPrs([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingPrs(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repoInfo]);

  const loadRepositories = useCallback(async () => {
    setLoadingRepos(true);
    try {
      const repos = await invoke("list_repositories");
      setRepositories(repos);
    } catch {
      // silently ignore — list may be empty on first run
    } finally {
      setLoadingRepos(false);
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

  const handleToggleKeyboardShortcuts = useCallback(
    async (enabled: boolean) => {
      setShowKeyboardShortcuts(enabled);
      try {
        const config = await invoke("load_app_config");
        await invoke("save_app_config", {
          config: { ...config, show_keyboard_shortcuts: enabled },
        });
      } catch {
        // continue even if save fails — UI already updated
      }
    },
    []
  );

  const handleNavigateToBranch = useCallback((branch: string) => {
    setNavigateToBranch(branch);
    setActiveTab("review");
    setSettingsOpen(false);
  }, []);

  const handleNavigateConsumed = useCallback(() => {
    setNavigateToBranch(null);
  }, []);

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
          setNavigateToBranch(null);
          break;
        case "n":
          setActiveTab("next-action");
          setSettingsOpen(false);
          setNavigateToBranch(null);
          break;
        case "a":
          setActiveTab("automate");
          setSettingsOpen(false);
          setNavigateToBranch(null);
          break;
        case "s":
          setSettingsOpen((prev) => !prev);
          break;
        case "Tab":
          e.preventDefault();
          setSettingsOpen(false);
          setNavigateToBranch(null);
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

  if (onboardingNeeded === null) {
    return (
      <ThemeProvider>
        <div className="flex h-screen items-center justify-center bg-bg-primary">
          <Loading />
        </div>
      </ThemeProvider>
    );
  }

  if (onboardingNeeded) {
    return (
      <ThemeProvider>
        <OnboardingPlaceholder onSkip={handleSkipOnboarding} />
      </ThemeProvider>
    );
  }

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
          loadingRepos={loadingRepos}
          navItems={[...NAV_ITEMS]}
          activeTabId={activeTab}
          onSelectTab={(id) => {
            setActiveTab(id as TabName);
            setSettingsOpen(false);
            setNavigateToBranch(null);
          }}
          settingsOpen={settingsOpen}
          onToggleSettings={() => setSettingsOpen((prev) => !prev)}
          showShortcuts={showKeyboardShortcuts}
          settingsContent={
            <div className="mx-auto max-w-xl space-y-8">
              <ThemeSettingsTab />
              <KeyboardShortcutSettingsTab
                enabled={showKeyboardShortcuts}
                onChange={handleToggleKeyboardShortcuts}
              />
              <GithubSettingsTab />
              <LlmSettingsTab />
              <AutomationSettingsTab />
            </div>
          }
        >
          {activeTab === "review" && (
            <ReviewTab
              prs={prs}
              loadingPrs={loadingPrs}
              navigateToBranch={navigateToBranch}
              onNavigateConsumed={handleNavigateConsumed}
            />
          )}
          {activeTab === "next-action" && (
            <TodoTab onNavigateToBranch={handleNavigateToBranch} />
          )}
          {activeTab === "automate" && <AutomationSettingsTab />}
        </Layout>
      </RepositoryProvider>
    </ThemeProvider>
  );
}
