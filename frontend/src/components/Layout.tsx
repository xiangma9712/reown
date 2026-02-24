import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import type { RepositoryEntry, RepoInfo } from "../types";

interface NavItem {
  id: string;
  labelKey: string;
  shortcut: string;
}

interface Props {
  repositories: RepositoryEntry[];
  selectedRepoPath: string | null;
  repoInfo: RepoInfo | null;
  onSelectRepo: (path: string) => void;
  onAddRepo: () => void;
  onRemoveRepo: (path: string) => void;
  navItems: NavItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  children: ReactNode;
}

export function Layout({
  repositories,
  selectedRepoPath,
  repoInfo,
  onSelectRepo,
  onAddRepo,
  onRemoveRepo,
  navItems,
  activeTabId,
  onSelectTab,
  children,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar
        repositories={repositories}
        selectedPath={selectedRepoPath}
        onSelect={onSelectRepo}
        onAdd={onAddRepo}
        onRemove={onRemoveRepo}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedRepoPath ? (
          <>
            <TabBar
              items={navItems}
              activeId={activeTabId}
              onSelect={onSelectTab}
            />
            <main className="scrollbar-custom flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-text-muted">{t("repository.selectPrompt")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
