"use client";

import { useState } from "react";
import { FileText, AlertCircle, Copy, Check } from "lucide-react";
import { CodeBlock } from "@/components/workspace/CodeBlock";
import { LoadingState } from "@/components/workspace/LoadingState";
import type { DocumentationResult } from "@/types/ai";

const LANGUAGES = [
  "auto-detect", "typescript", "javascript", "python", "java", "go",
  "rust", "c", "c++", "c#", "php", "ruby", "swift", "kotlin",
];

export default function DocumentPage() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("auto-detect");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DocumentationResult | null>(null);
  const [meta, setMeta] = useState<{ model: string; durationMs: number } | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"docstring" | "params" | "readme">("docstring");
  const [readmeCopied, setReadmeCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");

    const res = await fetch("/api/ai/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok || !data.success) {
      setError(data.error || "Documentation generation failed.");
      return;
    }

    setResult(data.data);
    setMeta({ model: data.model, durationMs: data.durationMs });
  }

  async function copyReadme() {
    if (!result) return;
    await navigator.clipboard.writeText(result.readmeSectionMarkdown);
    setReadmeCopied(true);
    setTimeout(() => setReadmeCopied(false), 2000);
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📄 Documentation Generator</h1>
        <p className="page-description">
          Generate docstrings, parameter tables, and README sections for your code automatically.
        </p>
      </div>

      <div className="page-content">
        <div className="workspace">
          {/* Input */}
          <div className="workspace-panel">
            <form onSubmit={handleSubmit}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "0.5rem" }}>
                <label className="label" style={{ margin: 0 }}>Code to document</label>
                <select
                  className="select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  style={{ fontSize: "0.8125rem" }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <textarea
                className="textarea"
                placeholder="Paste a function, class, or module to document..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{ minHeight: 360, marginBottom: "1rem" }}
              />
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading || !code.trim()}
              >
                {loading ? (
                  <><div className="spinner" style={{ width: 16, height: 16 }} /> Generating...</>
                ) : (
                  <><FileText size={16} /> Generate Documentation</>
                )}
              </button>
            </form>
          </div>

          {/* Output */}
          <div className="workspace-panel">
            {loading && <LoadingState message="Generating documentation..." />}

            {error && (
              <div className="alert alert-error">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {result && !loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {meta && (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span className="model-tag">🤖 {meta.model}</span>
                    <span className="text-xs text-muted">{(meta.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                )}

                {/* Overview */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: "0.5rem" }}>Overview</div>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {result.overview}
                  </p>
                </div>

                {/* Tabs */}
                <div className="tabs">
                  {(["docstring", "params", "readme"] as const).map((tab) => (
                    <button
                      key={tab}
                      className={`tab-btn ${activeTab === tab ? "active" : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab === "docstring" ? "Docstring" : tab === "params" ? "Parameters" : "README"}
                    </button>
                  ))}
                </div>

                {activeTab === "docstring" && (
                  <div>
                    <div className="section-title">Generated Docstring</div>
                    <CodeBlock code={result.docstring} language="text" />
                    {result.examples.length > 0 && (
                      <>
                        <div className="section-title" style={{ marginTop: "1rem" }}>Examples</div>
                        {result.examples.map((ex, i) => (
                          <div key={i} style={{ marginBottom: "0.75rem" }}>
                            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.375rem" }}>
                              {ex.title}
                            </div>
                            <CodeBlock code={ex.code} language={language} />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {activeTab === "params" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {result.parameters.length > 0 && (
                      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                        <div style={{ padding: "0.75rem 1rem", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}>
                          <div className="output-panel-title">Parameters</div>
                        </div>
                        {result.parameters.map((p, i) => (
                          <div
                            key={i}
                            style={{
                              padding: "0.75rem 1rem",
                              borderBottom: i < result.parameters.length - 1 ? "1px solid var(--border-subtle)" : "none",
                              display: "flex",
                              gap: "1rem",
                              alignItems: "flex-start",
                            }}
                          >
                            <div style={{ width: 120, flexShrink: 0 }}>
                              <code style={{ fontSize: "0.8125rem" }}>{p.name}</code>
                              {p.required && <span className="badge badge-info" style={{ marginLeft: "0.375rem", fontSize: "0.625rem" }}>required</span>}
                            </div>
                            <div style={{ width: 100, flexShrink: 0 }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{p.type}</span>
                            </div>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{p.description}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {result.returns && (
                      <div className="card">
                        <div className="card-title" style={{ marginBottom: "0.375rem" }}>Returns</div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                          <code>{result.returns.type}</code>
                        </div>
                        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{result.returns.description}</p>
                      </div>
                    )}

                    {result.raises.length > 0 && (
                      <div className="card">
                        <div className="card-title" style={{ marginBottom: "0.625rem" }}>Raises</div>
                        {result.raises.map((r, i) => (
                          <div key={i} style={{ display: "flex", gap: "1rem", marginBottom: "0.375rem" }}>
                            <code style={{ fontSize: "0.8125rem", color: "var(--color-error)", flexShrink: 0 }}>{r.type}</code>
                            <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{r.condition}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "readme" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
                      <button onClick={copyReadme} className="btn btn-secondary btn-sm">
                        {readmeCopied ? <><Check size={13} color="var(--color-success)" /> Copied!</> : <><Copy size={13} /> Copy Markdown</>}
                      </button>
                    </div>
                    <div
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        padding: "1.25rem",
                        fontFamily: "var(--font-inter), sans-serif",
                        fontSize: "0.875rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                        overflowX: "auto",
                      }}
                    >
                      {result.readmeSectionMarkdown}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!result && !loading && !error && (
              <div className="output-panel">
                <div className="empty-state">
                  <div className="empty-state-icon">📄</div>
                  <div className="empty-state-title">No documentation yet</div>
                  <div className="empty-state-description">
                    Paste a function or class on the left to generate docstrings, parameter tables, and README content.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
