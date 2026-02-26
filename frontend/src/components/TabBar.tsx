import { useRef, type KeyboardEvent } from "react";
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
  const tablistRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent) => {
    const currentIndex = items.findIndex((item) => item.id === activeId);
    let nextIndex: number | null = null;

    switch (e.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % items.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + items.length) % items.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    onSelect(items[nextIndex].id);
    const tabs = tablistRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs?.[nextIndex]?.focus();
  };

  return (
    <div role="tablist" ref={tablistRef} className="flex bg-bg-primary" onKeyDown={handleKeyDown}>
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={activeId === item.id}
          aria-controls={`tabpanel-${item.id}`}
          id={`tab-${item.id}`}
          tabIndex={activeId === item.id ? 0 : -1}
          onClick={() => onSelect(item.id)}
          className={`cursor-pointer border-none px-5 py-2.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
            activeId === item.id
              ? "border-b-2 border-b-accent bg-transparent text-accent"
              : "border-b-2 border-b-transparent bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          }`}
          aria-keyshortcuts={item.shortcut}
        >
          <span>{t(item.labelKey)}</span>
          <kbd
            aria-hidden="true"
            className="ml-2 rounded border border-border-hover bg-bg-hint px-1.5 text-[0.7rem] text-text-muted"
          >
            {item.shortcut}
          </kbd>
        </button>
      ))}
    </div>
  );
}
