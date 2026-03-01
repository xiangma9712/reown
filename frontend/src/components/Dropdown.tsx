import { ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export interface DropdownItem {
  label: string;
  onSelect: () => void;
  variant?: "default" | "danger";
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "start" | "center" | "end";
}

export function Dropdown({ trigger, items, align = "end" }: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[140px] rounded-lg border border-border bg-bg-primary p-1 shadow-lg"
          sideOffset={4}
          align={align}
        >
          {items.map((item, i) => {
            const prevItem = items[i - 1];
            const needsSeparator =
              item.variant === "danger" && prevItem?.variant !== "danger";
            return (
              <span key={i}>
                {needsSeparator && (
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                )}
                <DropdownMenu.Item
                  className={`cursor-pointer rounded px-3 py-1.5 text-sm outline-none transition-colors hover:bg-bg-hover focus:bg-bg-hover ${
                    item.variant === "danger"
                      ? "font-semibold text-danger"
                      : "text-text-primary"
                  }`}
                  onSelect={item.onSelect}
                >
                  {item.label}
                </DropdownMenu.Item>
              </span>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Chevron（▼）アイコン — ドロップダウントリガーの展開シグナル用 */
export function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 text-text-muted ${className}`}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M3 5l3 3 3-3" />
    </svg>
  );
}
