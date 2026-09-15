"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  MessageSquare,
  Search,
  Code2,
  Bug,
  FileText,
  History,
  LogOut,
  Cpu,
  ShieldCheck,
} from "lucide-react";

const navItems = [
  { href: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/platform/reliability", label: "Reliability", icon: ShieldCheck },
  { href: "/platform/assistant", label: "AI Assistant", icon: MessageSquare },
];

const toolItems = [
  { href: "/platform/analyze", label: "Code Analysis", icon: Search },
  { href: "/platform/generate", label: "Code Generation", icon: Code2 },
  { href: "/platform/debug", label: "Debugger", icon: Bug },
  { href: "/platform/document", label: "Documentation", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="platform-sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Cpu size={18} color="white" />
        </div>
        <div>
          <div className="sidebar-logo-text">AI Engineering</div>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Platform</div>
        </div>
      </div>

      {/* Main nav */}
      <div style={{ flex: 1, padding: "0.5rem 0" }}>
        <p className="sidebar-section-label">Navigation</p>
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-nav-item ${pathname === href ? "active" : ""}`}
          >
            <Icon className="nav-icon" size={18} />
            {label}
          </Link>
        ))}

        <p className="sidebar-section-label" style={{ marginTop: "1rem" }}>AI Tools</p>
        {toolItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-nav-item ${pathname === href ? "active" : ""}`}
          >
            <Icon className="nav-icon" size={18} />
            {label}
          </Link>
        ))}

        <p className="sidebar-section-label" style={{ marginTop: "1rem" }}>Account</p>
        <Link
          href="/platform/history"
          className={`sidebar-nav-item ${pathname === "/platform/history" ? "active" : ""}`}
        >
          <History className="nav-icon" size={18} />
          History
        </Link>
      </div>

      {/* User footer */}
      <div className="sidebar-footer">
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          padding: "0.5rem 0.75rem",
          marginBottom: "0.25rem",
        }}>
          <div style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "var(--brand-gradient)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "white",
            flexShrink: 0,
          }}>
            {session?.user?.name?.[0]?.toUpperCase() ??
              session?.user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session?.user?.name ?? "User"}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session?.user?.email}
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="sidebar-nav-item"
          style={{ color: "var(--color-error)", width: "100%" }}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
