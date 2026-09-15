"use client";

import { useState } from "react";
import { Play, AlertCircle } from "lucide-react";
import { CodeBlock } from "@/components/workspace/CodeBlock";
import { LoadingState } from "@/components/workspace/LoadingState";
import type { AnalysisResult } from "@/types/ai";
import type { Metadata } from "next";

const LANGUAGES = [
  "auto-detect", "typescript", "javascript", "python", "java", "go",
  "rust", "c", "c++", "c#", "php", "ruby", "swift", "kotlin",
  "sql", "bash", "html", "css",
];

function ScoreCircle({ score }: { score: number }) {
  const cls = score >= 7 ? "score-high" : score >= 4 ? "score-medium" : "score-low";
  return (
    <div className={`score-circle ${cls}`}>{score}</div>
  );
}

export default function AnalyzePage() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("auto-detect");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [meta, setMeta] = useState<{ model: string; durationMs: number } | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");

    const res = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok || !data.success) {
      setError(data.error || "Analysis failed.");
      return;
    }

    setResult(data.data);
    setMeta({ model: data.model, durationMs: data.durationMs });
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🔍 Code Analysis</h1>
        <p className="page-description">
          Paste your code to receive quality scores, bug detection, and improvement suggestions.
        </p>
      </div>

      <div className="page-content">
        <div className="workspace">
          {/* Input panel */}
          <div className="workspace-panel">
            <form onSubmit={handleSubmit}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "0.5rem" }}>
                <label className="label" style={{ margin: 0 }}>Code to analyse</label>
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
                placeholder="Paste your code here..."
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
                  <><div className="spinner" style={{ width: 16, height: 16 }} /> Analysing...</>
                ) : (
                  <><Play size={16} /> Analyse Code</>
                )}
              </button>
            </form>
          </div>

          {/* Output panel */}
          <div className="workspace-panel">
            {loading && <LoadingState message="Analysing your code..." />}

            {error && (
              <div className="alert alert-error">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {result && !loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Meta */}
                {meta && (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span className="model-tag">🤖 {meta.model}</span>
                    <span className="text-xs text-muted">{(meta.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                )}

                {/* Summary */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: "0.5rem" }}>Summary</div>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {result.summary}
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                    <span className="badge badge-info">{result.language}</span>
                  </div>
                </div>

                {/* Quality */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: "0.75rem" }}>Quality Score</div>
                  <div className="score-ring">
                    <ScoreCircle score={result.quality.score} />
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9375rem" }}>
                        {result.quality.label}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                        {result.quality.rationale}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bugs */}
                {result.bugs.length > 0 && (
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: "0.75rem" }}>
                      Bugs &amp; Issues ({result.bugs.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                      {result.bugs.map((bug, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "0.75rem",
                            background: "var(--bg-elevated)",
                            borderRadius: "var(--radius-sm)",
                            borderLeft: `3px solid var(--sev-${bug.severity})`,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                            <span className={`badge badge-${bug.severity}`}>{bug.severity}</span>
                            <span className="text-xs text-muted">Line {bug.line}</span>
                          </div>
                          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{bug.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Improvements */}
                {result.improvements.length > 0 && (
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: "0.75rem" }}>Improvements</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                      {result.improvements.map((imp, i) => (
                        <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                          <span className="badge badge-purple" style={{ flexShrink: 0, marginTop: "0.125rem" }}>
                            {imp.category}
                          </span>
                          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            {imp.suggestion}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Positives */}
                {result.positives.length > 0 && (
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: "0.75rem" }}>✅ What&apos;s Working Well</div>
                    <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      {result.positives.map((p, i) => (
                        <li key={i} style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Maintainability */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: "0.5rem" }}>
                    Maintainability — {result.maintainability.score}/10
                  </div>
                  <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    {result.maintainability.observations.map((o, i) => (
                      <li key={i} style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{o}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {!result && !loading && !error && (
              <div className="output-panel">
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-title">No analysis yet</div>
                  <div className="empty-state-description">
                    Paste your code on the left and click Analyse Code to get AI-powered feedback.
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
