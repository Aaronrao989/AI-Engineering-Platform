"use client";

import { useState, useEffect } from "react";
import { History, RefreshCw, Search } from "lucide-react";

const TOOLS = ["all", "analyze", "generate", "debug", "document"];

const TOOL_LABELS: Record<string, string> = {
  analyze: "Code Analysis",
  generate: "Code Generation",
  debug: "Debugger",
  document: "Documentation",
};

const TOOL_EMOJI: Record<string, string> = {
  analyze: "🔍",
  generate: "⚡",
  debug: "🐛",
  document: "📄",
};

interface Interaction {
  id: string;
  tool: string;
  input: string;
  output: string;
  model: string;
  durationMs: number;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function HistoryPage() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selectedTool, setSelectedTool] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function loadHistory() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (selectedTool !== "all") params.set("tool", selectedTool);

    const res = await fetch(`/api/history?${params}`);
    const data = await res.json();
    setInteractions(data.interactions ?? []);
    setPagination(data.pagination as Pagination | null);
    setLoading(false);
  }

  useEffect(() => {
    loadHistory();
  }, [selectedTool, page]);

  function getInputSummary(tool: string, inputStr: string): string {
    try {
      const input = JSON.parse(inputStr);
      if (tool === "analyze" || tool === "document") return (input.code?.slice(0, 80) ?? "") + "...";
      if (tool === "generate") return input.description?.slice(0, 80) ?? "";
      if (tool === "debug") return (input.errorMessage || input.code || "").slice(0, 60);
    } catch {}
    return inputStr.slice(0, 80);
  }

  // Safe JSON pretty-print: never throw during render on a malformed record.
  function prettyJson(str: string): string {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">History</h1>
        <p className="page-description">Your AI tool interaction history</p>
      </div>

      <div className="page-content">
        {/* Filters */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {TOOLS.map((t) => (
            <button
              key={t}
              onClick={() => { setSelectedTool(t); setPage(1); }}
              className={`btn btn-sm ${selectedTool === t ? "btn-primary" : "btn-secondary"}`}
            >
              {t === "all" ? "All Tools" : `${TOOL_EMOJI[t]} ${TOOL_LABELS[t]}`}
            </button>
          ))}
          <button
            onClick={loadHistory}
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: "auto" }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && interactions.length === 0 && (
          <div className="empty-state" style={{ padding: "4rem 2rem" }}>
            <History size={32} style={{ opacity: 0.3 }} />
            <div className="empty-state-title">No interactions yet</div>
            <div className="empty-state-description">
              Use any AI tool to see your history here.
            </div>
          </div>
        )}

        {!loading && interactions.length > 0 && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", marginBottom: "1.5rem" }}>
              {interactions.map((item) => (
                <div
                  key={item.id}
                  className="card"
                  style={{ cursor: "pointer", padding: 0, overflow: "hidden" }}
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1.25rem" }}>
                    <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>{TOOL_EMOJI[item.tool] ?? "🤖"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)", marginBottom: "0.125rem" }}>
                        {TOOL_LABELS[item.tool] ?? item.tool}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {getInputSummary(item.tool, item.input)}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <div className="text-xs text-muted">
                        {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="text-xs text-muted" style={{ marginTop: "0.125rem" }}>
                        {(item.durationMs / 1000).toFixed(1)}s
                      </div>
                    </div>
                  </div>

                  {expanded === item.id && (
                    <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "1rem 1.25rem" }}>
                      <div style={{ marginBottom: "1rem" }}>
                        <div className="section-title">Input</div>
                        <pre style={{
                          background: "var(--bg-base)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-sm)",
                          padding: "0.75rem",
                          fontSize: "0.8125rem",
                          color: "var(--text-secondary)",
                          whiteSpace: "pre-wrap",
                          overflowX: "auto",
                          fontFamily: "JetBrains Mono, ui-monospace, monospace",
                          maxHeight: 200,
                          overflow: "auto",
                        }}>
                          {prettyJson(item.input)}
                        </pre>
                      </div>
                      <div>
                        <div className="section-title">Output</div>
                        <pre style={{
                          background: "var(--bg-base)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-sm)",
                          padding: "0.75rem",
                          fontSize: "0.8125rem",
                          color: "var(--text-secondary)",
                          whiteSpace: "pre-wrap",
                          overflowX: "auto",
                          fontFamily: "JetBrains Mono, ui-monospace, monospace",
                          maxHeight: 300,
                          overflow: "auto",
                        }}>
                          {prettyJson(item.output)}
                        </pre>
                      </div>
                      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                        <span className="model-tag">🤖 {item.model}</span>
                        <span className="text-xs text-muted" style={{ alignSelf: "center" }}>{item.durationMs}ms</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem" }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn btn-secondary btn-sm"
                >
                  Previous
                </button>
                <span style={{ display: "flex", alignItems: "center", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Page {page} of {pagination.pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page >= pagination.pages}
                  className="btn btn-secondary btn-sm"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
