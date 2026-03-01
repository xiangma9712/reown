import { useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import * as Tooltip from "@radix-ui/react-tooltip";

interface NavItem {
  id: string;
  labelKey: string;
  shortcut: string;
}

interface Props {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  showShortcuts?: boolean;
}

export function TabBar({
  items,
  activeId,
  onSelect,
  showShortcuts = false,
}: Props) {
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
    const tabs =
      tablistRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs?.[nextIndex]?.focus();
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <div
        role="tablist"
        ref={tablistRef}
        className="flex bg-bg-primary"
        onKeyDown={handleKeyDown}
      >
        {items.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={activeId === item.id}
            aria-controls={`tabpanel-${item.id}`}
            id={`tab-${item.id}`}
            tabIndex={activeId === item.id ? 0 : -1}
            onClick={() => onSelect(item.id)}
            className={`group cursor-pointer border-none px-5 py-2.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
              activeId === item.id
                ? "border-b-[3px] border-b-accent bg-bg-hover font-bold text-accent"
                : "border-b-[3px] border-b-transparent bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
            aria-keyshortcuts={item.shortcut}
          >
            <span>{t(item.labelKey)}</span>
            {showShortcuts && (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <kbd
                    aria-hidden="true"
                    className="ml-2 hidden cursor-default items-center gap-0.5 rounded border border-border-hover bg-bg-hint px-1.5 text-[0.7rem] text-text-muted group-hover:inline-flex"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <line x1="6" y1="8" x2="6" y2="8" />
                      <line x1="10" y1="8" x2="10" y2="8" />
                      <line x1="14" y1="8" x2="14" y2="8" />
                      <line x1="18" y1="8" x2="18" y2="8" />
                      <line x1="6" y1="12" x2="6" y2="12" />
                      <line x1="10" y1="12" x2="10" y2="12" />
                      <line x1="14" y1="12" x2="14" y2="12" />
                      <line x1="18" y1="12" x2="18" y2="12" />
                      <line x1="8" y1="16" x2="16" y2="16" />
                    </svg>
                    {item.shortcut}
                  </kbd>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="z-50 rounded bg-bg-tooltip px-3 py-2 text-sm text-text-tooltip shadow-md"
                    side="bottom"
                    sideOffset={8}
                  >
                    {t("tabs.shortcutTooltip", { key: item.shortcut })}
                    <Tooltip.Arrow className="fill-bg-tooltip" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
          </button>
        ))}
      </div>
    </Tooltip.Provider>
  );
}
