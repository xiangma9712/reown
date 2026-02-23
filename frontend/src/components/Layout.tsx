import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface NavItem {
  id: string;
  labelKey: string;
  shortcut: string;
}

interface Props {
  navItems: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  children: ReactNode;
}

export function Layout({ navItems, activeId, onSelect, children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar items={navItems} activeId={activeId} onSelect={onSelect} />
      <main className="scrollbar-custom flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
