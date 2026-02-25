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

export function TabBar({ items, activeId, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex bg-bg-primary">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={`cursor-pointer border-none px-5 py-2.5 text-base transition-colors ${
            activeId === item.id
              ? "border-b-2 border-b-accent bg-transparent text-accent"
              : "border-b-2 border-b-transparent bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          }`}
        >
          <span>{t(item.labelKey)}</span>
          <kbd className="ml-2 rounded border border-border-hover bg-bg-hint px-1.5 text-[0.7rem] text-text-muted">
            {item.shortcut}
          </kbd>
        </button>
      ))}
    </div>
  );
}
