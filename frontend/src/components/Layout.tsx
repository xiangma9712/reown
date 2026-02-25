import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import type { RepositoryEntry } from "../types";

interface NavItem {
  id: string;
  labelKey: string;
  shortcut: string;
}

interface Props {
  repositories: RepositoryEntry[];
  selectedRepoPath: string | null;
  onSelectRepo: (path: string) => void;
  onAddRepo: () => void;
  onRemoveRepo: (path: string) => void;
  navItems: NavItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  branchSelector?: ReactNode;
  children: ReactNode;
}

export function Layout({
  repositories,
  selectedRepoPath,
  onSelectRepo,
  onAddRepo,
  onRemoveRepo,
  navItems,
  activeTabId,
  onSelectTab,
  branchSelector,
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
            <div className="flex items-center border-b border-border bg-bg-primary">
              {branchSelector && (
                <div className="shrink-0 border-r border-border px-4 py-2">
                  {branchSelector}
                </div>
              )}
              <TabBar
                items={navItems}
                activeId={activeTabId}
                onSelect={onSelectTab}
              />
            </div>
            <main className="scrollbar-custom flex-1 overflow-y-auto p-8">
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
