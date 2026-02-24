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
          {items.map((item, i) => (
            <DropdownMenu.Item
              key={i}
              className={`cursor-pointer rounded px-3 py-1.5 text-[0.8rem] outline-none transition-colors hover:bg-bg-hover focus:bg-bg-hover ${
                item.variant === "danger"
                  ? "font-semibold text-danger"
                  : "text-text-primary"
              }`}
              onSelect={item.onSelect}
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
