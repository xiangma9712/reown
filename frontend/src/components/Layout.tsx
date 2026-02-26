import { type ReactNode, useState, useCallback, useEffect } from "react";
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
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
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
  settingsOpen,
  onToggleSettings,
  branchSelector,
  children,
}: Props) {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleSelectRepo = useCallback(
    (path: string) => {
      onSelectRepo(path);
      setDrawerOpen(false);
    },
    [onSelectRepo]
  );

  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Desktop sidebar — hidden on small screens */}
      <div className="hidden md:block">
        <Sidebar
          repositories={repositories}
          selectedPath={selectedRepoPath}
          onSelect={onSelectRepo}
          onAdd={onAddRepo}
          onRemove={onRemoveRepo}
          settingsOpen={settingsOpen}
          onToggleSettings={onToggleSettings}
        />
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full w-56">
            <Sidebar
              repositories={repositories}
              selectedPath={selectedRepoPath}
              onSelect={handleSelectRepo}
              onAdd={onAddRepo}
              onRemove={onRemoveRepo}
              settingsOpen={settingsOpen}
              onToggleSettings={onToggleSettings}
              onClose={closeDrawer}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedRepoPath ? (
          <>
            <div className="flex items-center border-b border-border bg-bg-primary">
              {/* Hamburger button — visible only on small screens */}
              <button
                onClick={openDrawer}
                className="shrink-0 cursor-pointer border-none bg-transparent px-3 py-2 text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
                aria-label={t("sidebar.open")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
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
            <main
              role="tabpanel"
              id={`tabpanel-${activeTabId}`}
              aria-labelledby={`tab-${activeTabId}`}
              className="scrollbar-custom flex-1 overflow-y-auto p-8"
            >
              {children}
            </main>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            {/* Hamburger button for mobile when no repo selected */}
            <button
              onClick={openDrawer}
              className="cursor-pointer rounded border border-border bg-transparent px-4 py-2 text-text-secondary hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
              aria-label={t("sidebar.open")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <p className="text-text-muted">{t("repository.selectPrompt")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
