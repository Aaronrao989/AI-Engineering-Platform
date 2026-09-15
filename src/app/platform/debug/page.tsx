"use client";

import { useState } from "react";
import { Bug, AlertCircle, ChevronRight } from "lucide-react";
import { CodeBlock } from "@/components/workspace/CodeBlock";
import { LoadingState } from "@/components/workspace/LoadingState";
import type { DebugResult } from "@/types/ai";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "var(--sev-high)",
  high: "var(--sev-high)",
  medium: "var(--sev-medium)",
  low: "var(--sev-low)",
};

export default function DebugPage() {
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [meta, setMeta] = useState<{ model: string; durationMs: number } | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");

    const res = await fetch("/api/ai/debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, errorMessage, description }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok || !data.success) {
      setError(data.error || "Debug analysis failed.");
      return;
    }

    setResult(data.data);
    setMeta({ model: data.model, durationMs: data.durationMs });
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🐛 Debugging Assistant</h1>
        <p className="page-description">
          Provide your code and error information to receive a root-cause analysis and corrected fix.
        </p>
      </div>

      <div className="page-content">
        <div className="workspace">
          {/* Input */}
          <div className="workspace-panel">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Code with the bug *</label>
                <textarea
                  className="textarea"
                  placeholder="Paste the problematic code here..."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  style={{ minHeight: 220 }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="label">Error message / stack trace</label>
                <textarea
                  className="textarea"
                  placeholder="Paste the error message or stack trace (optional but recommended)..."
                  value={errorMessage}
                  onChange={(e) => setErrorMessage(e.target.value)}
                  style={{ minHeight: 100 }}
                />
              </div>

              <div className="form-group">
                <label className="label">Problem description</label>
                <textarea
                  className="textarea"
                  placeholder="Describe what's going wrong, what you expected vs what happened..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ minHeight: 80, fontFamily: "var(--font-inter), sans-serif" }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading || !code.trim()}
              >
                {loading ? (
                  <><div className="spinner" style={{ width: 16, height: 16 }} /> Diagnosing...</>
                ) : (
                  <><Bug size={16} /> Diagnose Bug</>
                )}
              </button>
            </form>
          </div>

          {/* Output */}
          <div className="workspace-panel">
            {loading && <LoadingState message="Diagnosing the bug..." />}

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

                {/* Root cause */}
                <div
                  className="card"
                  style={{
                    borderLeft: `3px solid ${SEVERITY_COLORS[result.severity] || "var(--sev-medium)"}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <div className="card-title">Root Cause</div>
                    <span
                      className={`badge badge-${result.severity === "critical" || result.severity === "high" ? "high" : result.severity === "medium" ? "medium" : "low"}`}
                    >
                      {result.severity}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.5 }}>
                    {result.rootCause}
                  </p>
                </div>

                {/* Explanation */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: "0.5rem" }}>Explanation</div>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                    {result.explanation}
                  </p>
                </div>

                {/* Fix description */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: "0.5rem" }}>Fix</div>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                    {result.fix.description}
                  </p>
                  {result.fix.changes.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      {result.fix.changes.map((c, i) => (
                        <li key={i} style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                          <ChevronRight size={12} style={{ display: "inline", marginRight: "0.25rem" }} />
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Corrected code */}
                {result.fix.correctedCode && (
                  <div>
                    <div className="section-title">Corrected Code</div>
                    <CodeBlock code={result.fix.correctedCode} language="auto" />
                  </div>
                )}

                {/* Prevention tips */}
                {result.preventionTips.length > 0 && (
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: "0.625rem" }}>🛡 Prevention Tips</div>
                    <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      {result.preventionTips.map((t, i) => (
                        <li key={i} style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!result && !loading && !error && (
              <div className="output-panel">
                <div className="empty-state">
                  <div className="empty-state-icon">🐛</div>
                  <div className="empty-state-title">No diagnosis yet</div>
                  <div className="empty-state-description">
                    Paste your buggy code and error message on the left. The more context you provide, the better the diagnosis.
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
