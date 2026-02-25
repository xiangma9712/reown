import { useTranslation } from "react-i18next";
import type { RepositoryEntry } from "../types";

interface Props {
  repositories: RepositoryEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onAdd: () => void;
  onRemove: (path: string) => void;
}

export function Sidebar({
  repositories,
  selectedPath,
  onSelect,
  onAdd,
  onRemove,
}: Props) {
  const { t } = useTranslation();

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
      <nav className="scrollbar-custom flex-1 overflow-y-auto py-1">
        {repositories.length === 0 ? (
          <p className="px-4 py-3 text-sm text-text-muted">
            {t("repository.empty")}
          </p>
        ) : (
          repositories.map((repo) => (
            <div
              key={repo.path}
              className={`group flex w-full items-center justify-between px-4 py-2 text-base transition-colors ${
                selectedPath === repo.path
                  ? "border-l-2 border-l-accent bg-bg-hover text-accent"
                  : "border-l-2 border-l-transparent bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              <button
                className="flex-1 cursor-pointer truncate border-none bg-transparent text-left text-inherit"
                onClick={() => onSelect(repo.path)}
                title={repo.path}
              >
                {repo.name}
              </button>
              <button
                className="ml-1 cursor-pointer border-none bg-transparent p-0.5 text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(repo.path);
                }}
                title={t("repository.remove")}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </nav>
      <div className="border-t border-border px-3 py-2">
        <button
          onClick={onAdd}
          className="flex w-full cursor-pointer items-center justify-center gap-1 rounded border border-border bg-transparent px-3 py-1.5 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent"
        >
          + {t("repository.add")}
        </button>
      </div>
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-text-muted">{t("app.tagline")}</p>
      </div>
    </aside>
  );
}
