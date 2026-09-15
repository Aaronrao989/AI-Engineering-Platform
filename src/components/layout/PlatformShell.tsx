"use client";

import { Sidebar } from "./Sidebar";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="platform-shell">
      <Sidebar />
      <main className="platform-main">{children}</main>
    </div>
  );
}
