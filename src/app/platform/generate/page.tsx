"use client";

import { useState } from "react";
import { Wand2, AlertCircle, Package, Info } from "lucide-react";
import { CodeBlock } from "@/components/workspace/CodeBlock";
import { LoadingState } from "@/components/workspace/LoadingState";
import type { GenerationResult } from "@/types/ai";

const LANGUAGES = [
  "auto-select", "typescript", "javascript", "python", "java", "go",
  "rust", "c", "c++", "c#", "php", "ruby", "swift", "kotlin",
  "sql", "bash",
];

export default function GeneratePage() {
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("auto-select");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [meta, setMeta] = useState<{ model: string; durationMs: number } | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");

    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, language: language === "auto-select" ? "" : language }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok || !data.success) {
      setError(data.error || "Generation failed.");
      return;
    }

    setResult(data.data);
    setMeta({ model: data.model, durationMs: data.durationMs });
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">⚡ Code Generation</h1>
        <p className="page-description">
          Describe what you want to build in plain English and get complete, production-ready code.
        </p>
      </div>

      <div className="page-content">
        <div className="workspace">
          {/* Input */}
          <div className="workspace-panel">
            <form onSubmit={handleSubmit}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "0.5rem" }}>
                <label className="label" style={{ margin: 0 }}>Task description</label>
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
                placeholder={`Describe what you want to build. Be specific.\n\nExamples:\n• "A Python function that reads a CSV file and returns rows where a column value is above a threshold"\n• "A TypeScript class for a rate limiter using the token bucket algorithm"\n• "A Go HTTP middleware that logs request duration and status code"`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ minHeight: 280, marginBottom: "1rem", fontFamily: "var(--font-inter), sans-serif" }}
              />
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading || !description.trim()}
              >
                {loading ? (
                  <><div className="spinner" style={{ width: 16, height: 16 }} /> Generating...</>
                ) : (
                  <><Wand2 size={16} /> Generate Code</>
                )}
              </button>
            </form>
          </div>

          {/* Output */}
          <div className="workspace-panel">
            {loading && <LoadingState message="Generating code..." />}

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

                {/* Title + explanation */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: "0.5rem" }}>{result.title}</div>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {result.explanation}
                  </p>
                </div>

                {/* Generated code */}
                <div>
                  <div className="section-title">Generated Code</div>
                  <CodeBlock code={result.code} language={result.language} />
                </div>

                {/* Usage */}
                {result.usage && (
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Info size={15} color="var(--color-info)" />
                      Usage Example
                    </div>
                    <pre style={{ margin: 0, fontFamily: "JetBrains Mono, ui-monospace, monospace", fontSize: "0.8125rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {result.usage}
                    </pre>
                  </div>
                )}

                {/* Dependencies */}
                {result.dependencies && result.dependencies.length > 0 && (
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: "0.625rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Package size={15} />
                      Dependencies
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                      {result.dependencies.map((dep, i) => (
                        <code key={i} style={{ background: "var(--bg-elevated)", padding: "0.2em 0.5em", borderRadius: 4, fontSize: "0.8125rem" }}>
                          {dep}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {result.notes && result.notes.length > 0 && (
                  <div className="alert alert-info">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      {result.notes.map((note, i) => (
                        <span key={i} style={{ fontSize: "0.8125rem" }}>💡 {note}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!result && !loading && !error && (
              <div className="output-panel">
                <div className="empty-state">
                  <div className="empty-state-icon">⚡</div>
                  <div className="empty-state-title">Ready to generate</div>
                  <div className="empty-state-description">
                    Describe your programming task on the left. Be as specific as possible for the best results.
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
