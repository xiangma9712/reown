import {
  type ReactNode,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import type { RepositoryEntry } from "../types";

const STORAGE_KEY = "reown-sidebar-collapsed";
const WIDTH_STORAGE_KEY = "reown-sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 224; // w-56 = 14rem = 224px
const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_WIDTH = 480;

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
  addingRepo?: boolean;
  addRepoError?: string | null;
  onDismissAddRepoError?: () => void;
  loadingRepos?: boolean;
  navItems: NavItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
  settingsContent?: ReactNode;
  branchSelector?: ReactNode;
  children: ReactNode;
}

export function Layout({
  repositories,
  selectedRepoPath,
  onSelectRepo,
  onAddRepo,
  onRemoveRepo,
  addingRepo,
  addRepoError,
  onDismissAddRepoError,
  loadingRepos,
  navItems,
  activeTabId,
  onSelectTab,
  settingsOpen,
  onToggleSettings,
  settingsContent,
  branchSelector,
  children,
}: Props) {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(WIDTH_STORAGE_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const handleSelectRepo = useCallback(
    (path: string) => {
      onSelectRepo(path);
      setDrawerOpen(false);
    },
    [onSelectRepo]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };
      setResizing(true);
    },
    [sidebarWidth]
  );

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, resizeRef.current.startWidth + delta)
      );
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setResizing(false);
      resizeRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

  // Persist sidebar width to localStorage when resizing ends
  const prevResizingRef = useRef(false);
  useEffect(() => {
    if (prevResizingRef.current && !resizing) {
      try {
        localStorage.setItem(WIDTH_STORAGE_KEY, String(sidebarWidth));
      } catch {
        // ignore storage errors
      }
    }
    prevResizingRef.current = resizing;
  }, [resizing, sidebarWidth]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (drawerOpen && e.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      // Toggle sidebar collapse with "[" key (desktop only, not in inputs)
      if (
        e.key === "[" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        window.matchMedia("(min-width: 768px)").matches &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target instanceof HTMLElement && e.target.isContentEditable)
        )
      ) {
        toggleCollapse();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen, toggleCollapse]);

  return (
    <div
      className={`flex h-screen overflow-hidden bg-bg-primary${resizing ? " select-none" : ""}`}
    >
      {/* Desktop sidebar — hidden on small screens */}
      <div className="hidden md:flex">
        <Sidebar
          repositories={repositories}
          selectedPath={selectedRepoPath}
          onSelect={onSelectRepo}
          onAdd={onAddRepo}
          onRemove={onRemoveRepo}
          adding={addingRepo}
          addError={addRepoError}
          onDismissAddError={onDismissAddRepoError}
          loading={loadingRepos}
          settingsOpen={settingsOpen}
          onToggleSettings={onToggleSettings}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          width={collapsed ? undefined : sidebarWidth}
        />
        {!collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t("sidebar.resizeHandle")}
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuemax={MAX_SIDEBAR_WIDTH}
            aria-valuenow={sidebarWidth}
            className={`group flex w-1 shrink-0 cursor-col-resize items-center justify-center hover:bg-accent/20 active:bg-accent/30 ${
              resizing ? "bg-accent/30" : ""
            }`}
            onMouseDown={handleResizeStart}
          >
            <div
              className={`h-8 w-0.5 rounded-full bg-border group-hover:bg-accent/60 group-active:bg-accent ${
                resizing ? "bg-accent" : ""
              }`}
            />
          </div>
        )}
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
              adding={addingRepo}
              addError={addRepoError}
              onDismissAddError={onDismissAddRepoError}
              loading={loadingRepos}
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
              {!settingsOpen && branchSelector && (
                <div className="shrink-0 border-r border-border px-4 py-2">
                  {branchSelector}
                </div>
              )}
              {settingsOpen ? (
                <div className="flex flex-1 items-center justify-between px-4 py-2">
                  <h1 className="text-sm font-semibold text-text-primary">
                    {t("tabs.settings")}
                  </h1>
                  <button
                    onClick={onToggleSettings}
                    className="cursor-pointer rounded border-none bg-transparent p-1 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label={t("tabs.settingsCloseAriaLabel")}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <TabBar
                  items={navItems}
                  activeId={activeTabId}
                  onSelect={onSelectTab}
                />
              )}
            </div>
            {settingsOpen && settingsContent ? (
              <div
                role="region"
                aria-label={t("tabs.settings")}
                className="scrollbar-custom flex-1 overflow-y-auto p-8"
              >
                {settingsContent}
              </div>
            ) : (
              <main
                role="tabpanel"
                id={`tabpanel-${activeTabId}`}
                aria-labelledby={`tab-${activeTabId}`}
                className="scrollbar-custom flex-1 overflow-y-auto p-8"
              >
                {children}
              </main>
            )}
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
