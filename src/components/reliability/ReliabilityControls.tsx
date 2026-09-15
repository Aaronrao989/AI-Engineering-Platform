"use client";

/**
 * Live demo controls for the reliability dashboard (Step 7).
 * Triggers a real multi-agent run — optionally injecting a fault — then
 * refreshes the server-rendered metrics so the effect is visible immediately.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, AlertTriangle } from "lucide-react";

const FAULT_OPTIONS = [
  { value: "none", label: "No fault (healthy run)" },
  { value: "model_unavailable", label: "Model unavailable → model fallback" },
  { value: "invalid_output", label: "Invalid output → prompt repair" },
  { value: "invalid_json", label: "Invalid JSON → prompt repair" },
  { value: "tool_error", label: "Tool error → retry" },
  { value: "timeout", label: "Timeout → retry" },
  { value: "loop", label: "Loop → escalation (bounded, not healed)" },
] as const;

interface RunSummary {
  runId: string;
  injectedFaults: number;
  failures: { failureType: string; suggestedStrategy: string }[];
  recoveries: { failureType: string; recovered: boolean; escalated: boolean }[];
  totalLatencyMs: number;
}

export default function ReliabilityControls() {
  const router = useRouter();
  const [task, setTask] = useState("Write a function that reverses a string.");
  const [fault, setFault] = useState<string>("none");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<RunSummary | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const faults =
        fault === "none" ? [] : [{ tool: "generate", type: fault }];
      const res = await fetch("/api/reliability/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, faults }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error ?? "Run failed.");
      }
      setLast(data as RunSummary);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: "2rem" }}>
      <div className="card-title" style={{ marginBottom: "0.75rem" }}>
        Live demo — run the pipeline
      </div>
      <p
        className="text-sm text-secondary"
        style={{ marginBottom: "1rem", lineHeight: 1.5 }}
      >
        Runs planner → worker → reviewer, then verify → evaluate → detect →
        self-heal. Injecting a fault demonstrates detection and recovery. Each
        run makes real Groq API calls and may take 10–30s.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Task for the agents…"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.6rem 0.75rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
          }}
        />
        <div
          style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}
        >
          <select
            value={fault}
            onChange={(e) => setFault(e.target.value)}
            disabled={loading}
            style={{
              padding: "0.6rem 0.75rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              fontSize: "0.875rem",
              flex: "1 1 260px",
            }}
          >
            {FAULT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={run}
            disabled={loading || task.trim().length === 0}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 0.7s linear infinite" }} /> Running…
              </>
            ) : (
              <>
                <Play size={16} /> Run
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="badge badge-high"
          style={{ marginTop: "1rem", display: "inline-flex", gap: "0.4rem" }}
        >
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {last && !error && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            fontSize: "0.85rem",
            lineHeight: 1.6,
          }}
        >
          <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>
            Last run · {last.injectedFaults} fault(s) injected ·{" "}
            {last.totalLatencyMs}ms
          </div>
          <div className="text-secondary">
            Detected {last.failures.length} failure(s); recovered{" "}
            {last.recoveries.filter((r) => r.recovered).length}, escalated{" "}
            {last.recoveries.filter((r) => r.escalated).length}.
          </div>
        </div>
      )}
    </div>
  );
}
