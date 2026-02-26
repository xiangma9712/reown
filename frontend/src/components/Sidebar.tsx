import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "./ConfirmDialog";
import type { RepositoryEntry } from "../types";

interface Props {
  repositories: RepositoryEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onAdd: () => void;
  onRemove: (path: string) => void;
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
}

export function Sidebar({
  repositories,
  selectedPath,
  onSelect,
  onAdd,
  onRemove,
  settingsOpen,
  onToggleSettings,
}: Props) {
  const { t } = useTranslation();
  const [removingRepo, setRemovingRepo] = useState<RepositoryEntry | null>(
    null
  );

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-sidebar-bg">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h1 className="text-xl font-bold text-text-heading">
          {t("app.title")}
        </h1>
      </div>
      <div className="border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("repository.title")}
        </span>
      </div>
      <nav className="scrollbar-custom flex-1 overflow-y-auto py-2">
        {repositories.length === 0 ? (
          <p className="px-4 py-3 text-sm text-text-muted">
            {t("repository.empty")}
          </p>
        ) : (
          repositories.map((repo) => (
            <div
              key={repo.path}
              aria-current={selectedPath === repo.path ? "true" : undefined}
              className={`group flex w-full items-center justify-between px-4 py-2 text-base transition-colors ${
                selectedPath === repo.path
                  ? "border-l-2 border-l-accent bg-bg-hover text-accent"
                  : "border-l-2 border-l-transparent bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              <button
                className="flex-1 cursor-pointer truncate rounded border-none bg-transparent text-left text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => onSelect(repo.path)}
                title={repo.path}
                aria-label={t("repository.selectAriaLabel", {
                  name: repo.name,
                })}
              >
                {repo.name}
              </button>
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
      <div className="border-t border-border px-4 py-3">
        <button
          onClick={onAdd}
          className="flex w-full cursor-pointer items-center justify-center gap-1 rounded border border-border bg-transparent px-3 py-1.5 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={t("repository.addAriaLabel")}
        >
          + {t("repository.add")}
        </button>
      </div>
      <div className="border-t border-border px-4 py-3">
        <button
          onClick={onToggleSettings}
          className={`flex w-full cursor-pointer items-center gap-2 rounded border-none bg-transparent px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            settingsOpen
              ? "text-accent"
              : "text-text-secondary hover:text-text-primary"
          }`}
          title={t("tabs.settings")}
          aria-label={t("tabs.settingsAriaLabel")}
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
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {t("tabs.settings")}
          <kbd className="ml-auto rounded border border-border-hover bg-bg-hint px-1.5 text-[0.7rem] text-text-muted">
            S
          </kbd>
        </button>
      </div>
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-text-muted">{t("app.tagline")}</p>
      </div>
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
  );
}
