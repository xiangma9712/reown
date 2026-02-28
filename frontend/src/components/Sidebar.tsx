import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import type { RepositoryEntry } from "../types";

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SettingsGearIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

interface Props {
  repositories: RepositoryEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onAdd: () => void;
  onRemove: (path: string) => void;
  adding?: boolean;
  addError?: string | null;
  onDismissAddError?: () => void;
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  width?: number;
  loading?: boolean;
}

export function Sidebar({
  repositories,
  selectedPath,
  onSelect,
  onAdd,
  onRemove,
  adding = false,
  addError = null,
  onDismissAddError,
  settingsOpen,
  onToggleSettings,
  onClose,
  collapsed = false,
  onToggleCollapse,
  width,
  loading = false,
}: Props) {
  const { t } = useTranslation();
  const [removingRepo, setRemovingRepo] = useState<RepositoryEntry | null>(
    null
  );

  return (
    <Tooltip.Provider delayDuration={300}>
      <aside
        className={`flex h-full flex-col overflow-hidden border-r border-border bg-sidebar-bg transition-[width] duration-200 ease-in-out ${
          collapsed ? "w-14" : ""
        }`}
        style={
          !collapsed && width
            ? { width: `${width}px` }
            : !collapsed
              ? { width: "14rem" }
              : undefined
        }
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          {collapsed ? (
            <span className="mx-auto text-xl font-bold text-text-heading">
              R
            </span>
          ) : (
            <span className="sidebar-fade-text text-xl font-bold text-text-heading">
              {t("app.title")}
            </span>
          )}
          {onClose && !collapsed && (
            <button
              onClick={onClose}
              className="sidebar-fade-text ml-auto cursor-pointer rounded border-none bg-transparent p-1 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={t("sidebar.close")}
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
          )}
        </div>
        {!collapsed && (
          <div className="sidebar-fade-text border-b border-border px-4 py-3">
            <h2
              id="sidebar-repositories-heading"
              className="m-0 text-xs font-semibold uppercase tracking-wider text-text-muted"
            >
              {t("repository.title")}
            </h2>
          </div>
        )}
        <nav
          aria-labelledby={
            !collapsed ? "sidebar-repositories-heading" : undefined
          }
          aria-label={collapsed ? t("repository.navAriaLabel") : undefined}
          aria-busy={loading}
          className="scrollbar-custom flex-1 overflow-y-auto py-2"
        >
          {loading ? (
            collapsed ? (
              <div
                role="status"
                aria-label={t("common.loading")}
                className="flex flex-col items-center gap-2 px-2 py-1"
              >
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-8 w-8 animate-pulse rounded bg-border/50"
                  />
                ))}
              </div>
            ) : (
              <div
                role="status"
                aria-label={t("common.loading")}
                className="space-y-1 px-4 py-1"
              >
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-8 animate-pulse rounded bg-border/50"
                  />
                ))}
              </div>
            )
          ) : collapsed ? (
            repositories.map((repo) => (
              <Tooltip.Root key={repo.path}>
                <Tooltip.Trigger asChild>
                  <button
                    aria-current={
                      selectedPath === repo.path ? "true" : undefined
                    }
                    className={`flex w-full cursor-pointer items-center justify-center py-2 transition-colors ${
                      selectedPath === repo.path
                        ? "border-l-2 border-l-accent bg-sidebar-selected font-semibold text-accent"
                        : "border-l-2 border-l-transparent bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                    } rounded-none border-y-0 border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent`}
                    onClick={() => onSelect(repo.path)}
                    aria-label={t("repository.selectAriaLabel", {
                      name: repo.name,
                    })}
                  >
                    <span className="flex flex-col items-center gap-0.5">
                      <span className="text-sm font-medium">
                        {repo.name.charAt(0).toUpperCase()}
                      </span>
                      {selectedPath === repo.path && (
                        <span
                          className="h-1 w-1 rounded-full bg-accent"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="z-50 max-w-xs rounded bg-bg-tooltip px-3 py-2 text-sm text-text-tooltip shadow-md"
                    side="right"
                    sideOffset={8}
                  >
                    <p className="font-semibold">{repo.name}</p>
                    <p className="text-xs opacity-80">{repo.path}</p>
                    <Tooltip.Arrow className="fill-bg-tooltip" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            ))
          ) : repositories.length === 0 ? (
            <div className="sidebar-fade-text">
              <EmptyState
                message={t("repository.emptyTitle")}
                description={t("repository.emptyDescription")}
                icon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                  </svg>
                }
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-text-muted/40"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              </EmptyState>
            </div>
          ) : (
            repositories.map((repo) => (
              <div
                key={repo.path}
                aria-current={selectedPath === repo.path ? "true" : undefined}
                className={`sidebar-fade-text group flex w-full items-center justify-between px-4 py-2 text-base transition-colors ${
                  selectedPath === repo.path
                    ? "border-l-2 border-l-accent bg-sidebar-selected font-semibold text-accent"
                    : "border-l-2 border-l-transparent bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                {selectedPath === repo.path && (
                  <span className="mr-1.5 flex shrink-0 items-center text-accent">
                    <CheckIcon />
                  </span>
                )}
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      className="min-w-0 flex-1 cursor-pointer truncate rounded border-none bg-transparent text-left text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => onSelect(repo.path)}
                      aria-label={t("repository.selectAriaLabel", {
                        name: repo.name,
                      })}
                    >
                      {repo.name}
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="z-50 max-w-xs rounded bg-bg-tooltip px-3 py-2 text-sm text-text-tooltip shadow-md"
                      side="right"
                      sideOffset={8}
                    >
                      <p className="font-semibold">{repo.name}</p>
                      <p className="text-xs opacity-80">{repo.path}</p>
                      <Tooltip.Arrow className="fill-bg-tooltip" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
                <button
                  className="ml-1 cursor-pointer rounded border-none bg-transparent p-0.5 text-text-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100 group-focus-within:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRemovingRepo(repo);
                  }}
                  title={t("repository.remove")}
                  aria-label={t("repository.removeAriaLabel", {
                    name: repo.name,
                  })}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </nav>
        {collapsed ? (
          <div className="border-t border-border px-2 py-3">
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={onAdd}
                  disabled={adding}
                  className="flex w-full cursor-pointer items-center justify-center rounded border border-border bg-transparent py-1.5 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t("repository.addAriaLabel")}
                  aria-busy={adding}
                >
                  {adding ? (
                    <span
                      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                      role="status"
                    >
                      <span className="sr-only">{t("repository.adding")}</span>
                    </span>
                  ) : (
                    "+"
                  )}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="z-50 rounded bg-bg-tooltip px-3 py-2 text-sm text-text-tooltip shadow-md"
                  side="right"
                  sideOffset={8}
                >
                  {adding ? t("repository.adding") : t("repository.add")}
                  <Tooltip.Arrow className="fill-bg-tooltip" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
        ) : (
          <div className="sidebar-fade-text border-t border-border px-4 py-3">
            <button
              onClick={onAdd}
              disabled={adding}
              className="flex w-full cursor-pointer items-center justify-center gap-1 rounded border border-border bg-transparent px-3 py-1.5 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t("repository.addAriaLabel")}
              aria-busy={adding}
            >
              {adding ? (
                <>
                  <span
                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                    role="status"
                  >
                    <span className="sr-only">{t("repository.adding")}</span>
                  </span>
                  {t("repository.adding")}
                </>
              ) : (
                <>+ {t("repository.add")}</>
              )}
            </button>
            {addError && (
              <div
                role="alert"
                className="mt-2 flex items-start gap-1 rounded border border-danger/30 bg-danger/10 px-2 py-1.5 text-xs text-danger"
              >
                <span className="flex-1">{addError}</span>
                {onDismissAddError && (
                  <button
                    onClick={onDismissAddError}
                    className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-danger transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label={t("common.cancel")}
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <div
          className={`border-t border-border ${collapsed ? "px-2" : "px-4"} py-3`}
        >
          {collapsed ? (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={onToggleSettings}
                  className={`flex w-full cursor-pointer items-center justify-center rounded border-none bg-transparent py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    settingsOpen
                      ? "text-accent"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                  title={t("tabs.settings")}
                  aria-label={t("tabs.settingsAriaLabel")}
                  aria-keyshortcuts="S"
                >
                  <SettingsGearIcon />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="z-50 rounded bg-bg-tooltip px-3 py-2 text-sm text-text-tooltip shadow-md"
                  side="right"
                  sideOffset={8}
                >
                  {t("tabs.settings")}
                  <Tooltip.Arrow className="fill-bg-tooltip" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ) : (
            <div className="sidebar-fade-text">
              <button
                onClick={onToggleSettings}
                className={`flex w-full cursor-pointer items-center gap-2 rounded border-none bg-transparent px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  settingsOpen
                    ? "text-accent"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                title={t("tabs.settings")}
                aria-label={t("tabs.settingsAriaLabel")}
                aria-keyshortcuts="S"
              >
                <SettingsGearIcon />
                {t("tabs.settings")}
                <kbd
                  aria-hidden="true"
                  className="ml-auto rounded border border-border-hover bg-bg-hint px-1.5 text-[0.7rem] text-text-muted"
                >
                  S
                </kbd>
              </button>
            </div>
          )}
        </div>
        {onToggleCollapse && (
          <div className="border-t border-border px-4 py-3">
            <button
              onClick={onToggleCollapse}
              className="flex w-full cursor-pointer items-center justify-center rounded border-none bg-transparent py-1 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-expanded={!collapsed}
              aria-label={
                collapsed ? t("sidebar.expand") : t("sidebar.collapse")
              }
              aria-keyshortcuts="["
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-200 ${
                  collapsed ? "rotate-180" : ""
                }`}
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>
        )}
        <ConfirmDialog
          open={removingRepo !== null}
          message={
            removingRepo
              ? t("repository.confirmRemove", { name: removingRepo.name })
              : ""
          }
          confirmLabel={t("repository.remove")}
          onConfirm={() => {
            if (removingRepo) {
              onRemove(removingRepo.path);
            }
            setRemovingRepo(null);
          }}
          onCancel={() => setRemovingRepo(null)}
        />
      </aside>
    </Tooltip.Provider>
  );
}
