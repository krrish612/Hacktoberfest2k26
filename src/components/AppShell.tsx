import type { ReactNode } from "react";
import type { AppInfo, Gear } from "../types";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  gears: Gear[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  info: AppInfo | null;
  runtime: string;
  hint: string;
  actions: ReactNode;
  children: ReactNode;
}

export function AppShell({
  gears,
  selectedId,
  onSelect,
  info,
  runtime,
  hint,
  actions,
  children,
}: AppShellProps) {
  return (
    <div className="app">
      <Sidebar gears={gears} selectedId={selectedId} onSelect={onSelect} info={info} runtime={runtime} />
      <main className="main">
        <header className="topbar">
          <h1 className="topbar__title">Gear passport</h1>
          <p className="topbar__hint">{hint}</p>
          <div className="topbar__actions">{actions}</div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
