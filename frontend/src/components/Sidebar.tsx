import { useTranslation } from "react-i18next";

interface NavItem {
  id: string;
  labelKey: string;
  shortcut: string;
}

interface Props {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function Sidebar({ items, activeId, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-bg-secondary">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold text-white">{t("app.title")}</h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex w-full cursor-pointer items-center justify-between border-none px-4 py-2 text-left text-[0.85rem] transition-colors ${
              activeId === item.id
                ? "border-l-2 border-l-accent bg-bg-hover text-accent"
                : "bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            <span>{t(item.labelKey)}</span>
            <kbd className="rounded border border-border-hover bg-bg-hint px-1.5 text-[0.65rem] text-text-muted">
              {item.shortcut}
            </kbd>
          </button>
        ))}
      </nav>
      <div className="border-t border-border px-4 py-3">
        <p className="text-[0.7rem] text-text-muted">{t("app.tagline")}</p>
      </div>
    </aside>
  );
}
