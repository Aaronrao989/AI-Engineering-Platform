import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import {
  MessageSquare,
  Search,
  Code2,
  Bug,
  FileText,
  Zap,
  Clock,
  BarChart3,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

const tools = [
  {
    href: "/platform/assistant",
    title: "AI Assistant",
    description:
      "Conversational engineering help — ask questions, get explanations, discuss architecture.",
    icon: "💬",
    iconBg: "rgba(99,102,241,0.15)",
    iconColor: "#818cf8",
  },
  {
    href: "/platform/analyze",
    title: "Code Analysis",
    description:
      "Paste your code and get a quality score, bug report, and actionable improvement suggestions.",
    icon: "🔍",
    iconBg: "rgba(59,130,246,0.15)",
    iconColor: "#60a5fa",
  },
  {
    href: "/platform/generate",
    title: "Code Generation",
    description:
      "Describe a programming task in plain English and get complete, production-ready code.",
    icon: "⚡",
    iconBg: "rgba(245,158,11,0.15)",
    iconColor: "#fbbf24",
  },
  {
    href: "/platform/debug",
    title: "Debugger",
    description:
      "Provide your code + error message and receive a root-cause diagnosis with a corrected fix.",
    icon: "🐛",
    iconBg: "rgba(239,68,68,0.15)",
    iconColor: "#f87171",
  },
  {
    href: "/platform/document",
    title: "Documentation",
    description:
      "Generate docstrings, JSDoc, parameter tables, and README sections for your code automatically.",
    icon: "📄",
    iconBg: "rgba(34,197,94,0.15)",
    iconColor: "#4ade80",
  },
];

const toolLabelMap: Record<string, string> = {
  analyze: "Code Analysis",
  generate: "Code Generation",
  debug: "Debugger",
  document: "Documentation",
};

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  // Load stats and recent interactions
  const [totalInteractions, recentInteractions] = await Promise.all([
    prisma.aIInteraction.count({ where: { userId: userId! } }),
    prisma.aIInteraction.findMany({
      where: { userId: userId! },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, tool: true, createdAt: true, durationMs: true },
    }),
  ]);

  const toolCounts = await prisma.aIInteraction.groupBy({
    by: ["tool"],
    where: { userId: userId! },
    _count: true,
  });

  const mostUsedTool =
    toolCounts.length > 0
      ? toolCounts.sort((a, b) => b._count - a._count)[0].tool
      : null;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          Welcome back, {session?.user?.name ?? session?.user?.email?.split("@")[0]} 👋
        </h1>
        <p className="page-description">
          Your AI-powered software engineering workspace
        </p>
      </div>

      <div className="page-content">
        {/* Stats row */}
        <div className="grid-3" style={{ marginBottom: "2rem" }}>
          <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-md)",
                background: "rgba(99,102,241,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <BarChart3 size={20} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontSize: "1.625rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                {totalInteractions}
              </div>
              <div className="text-sm text-secondary" style={{ marginTop: "0.25rem" }}>
                Total AI Interactions
              </div>
            </div>
          </div>

          <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-md)",
                background: "rgba(34,197,94,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Zap size={20} color="#4ade80" />
            </div>
            <div>
              <div style={{ fontSize: "1.625rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                {mostUsedTool ? toolLabelMap[mostUsedTool] ?? mostUsedTool : "—"}
              </div>
              <div className="text-sm text-secondary" style={{ marginTop: "0.25rem" }}>
                Most Used Tool
              </div>
            </div>
          </div>

          <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-md)",
                background: "rgba(59,130,246,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Clock size={20} color="#60a5fa" />
            </div>
            <div>
              <div style={{ fontSize: "1.625rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                {toolCounts.length}
              </div>
              <div className="text-sm text-secondary" style={{ marginTop: "0.25rem" }}>
                Tools Used
              </div>
            </div>
          </div>
        </div>

        {/* Tools grid */}
        <h2
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "1rem",
          }}
        >
          AI Engineering Tools
        </h2>
        <div className="grid-3" style={{ marginBottom: "2rem" }}>
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href} className="tool-card">
              <div
                className="tool-card-icon"
                style={{ background: tool.iconBg, fontSize: "1.375rem" }}
              >
                {tool.icon}
              </div>
              <div className="tool-card-title">{tool.title}</div>
              <div className="tool-card-description">{tool.description}</div>
            </Link>
          ))}
        </div>

        {/* Recent activity */}
        {recentInteractions.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1rem",
              }}
            >
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                Recent Activity
              </h2>
              <Link href="/platform/history" className="btn btn-ghost btn-sm">
                View all
              </Link>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {recentInteractions.map((item, i) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.875rem 1.25rem",
                    borderBottom:
                      i < recentInteractions.length - 1
                        ? "1px solid var(--border-subtle)"
                        : "none",
                  }}
                >
                  <span style={{ fontSize: "1.125rem" }}>
                    {tool_emoji(item.tool)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-sm" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                      {toolLabelMap[item.tool] ?? item.tool}
                    </div>
                    <div className="text-xs text-muted">
                      {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs text-muted">
                    {(item.durationMs / 1000).toFixed(1)}s
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function tool_emoji(tool: string): string {
  return { analyze: "🔍", generate: "⚡", debug: "🐛", document: "📄" }[tool] ?? "🤖";
}
