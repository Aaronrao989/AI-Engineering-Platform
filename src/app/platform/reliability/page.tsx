/**
 * Reliability dashboard (Step 7).
 * Shows the paper's KPIs — Task Success Rate before/after self-healing,
 * Failure Detection Rate, Recovery Success Rate, MTTR — computed from real
 * persisted runs, plus a live control to trigger runs and inject faults.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { computeMetrics, listRecentRuns } from "@/lib/reliability/metrics";
import ReliabilityControls from "@/components/reliability/ReliabilityControls";
import { ShieldCheck, Activity, Wrench, Timer } from "lucide-react";

export const metadata: Metadata = { title: "Reliability" };

const pct = (n: number | null) =>
  n == null ? "—" : `${Math.round(n * 100)}%`;

function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--radius-md)",
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: iconColor,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "1.625rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
          {value}
        </div>
        <div className="text-sm text-secondary" style={{ marginTop: "0.25rem" }}>
          {label}
        </div>
        {sub && (
          <div className="text-sm text-secondary" style={{ marginTop: "0.15rem", opacity: 0.75 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function ReliabilityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [metrics, runs] = await Promise.all([
    computeMetrics(userId),
    listRecentRuns(userId),
  ]);

  const before = metrics.taskSuccessRateBefore;
  const after = metrics.taskSuccessRateAfter;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reliability</h1>
        <p className="page-description">
          Observability, evaluation, and autonomous self-healing across{" "}
          {metrics.totalRuns} agent run{metrics.totalRuns === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="page-content">
        <ReliabilityControls />

        {/* Headline: reliability before vs after self-healing */}
        <div className="card" style={{ marginBottom: "2rem" }}>
          <div className="card-title" style={{ marginBottom: "1rem" }}>
            Task success rate — before vs after self-healing
          </div>
          {metrics.totalRuns === 0 ? (
            <p className="text-sm text-secondary">
              No runs yet. Use the control above to run the pipeline.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <BeforeAfterBar label="Before (no recovery)" value={before} color="#f87171" />
              <BeforeAfterBar label="After (self-healing)" value={after} color="#4ade80" />
              <div className="text-sm text-secondary">
                Reliability gain:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                  {metrics.reliabilityGain >= 0 ? "+" : ""}
                  {Math.round(metrics.reliabilityGain * 100)} pts
                </span>{" "}
                — {metrics.failuresResolved}/{metrics.totalFailuresDetected}{" "}
                detected failures resolved.
              </div>
            </div>
          )}
        </div>

        {/* KPI cards */}
        <div className="grid-3" style={{ marginBottom: "2rem" }}>
          <StatCard
            icon={<ShieldCheck size={20} />}
            iconBg="rgba(34,197,94,0.15)"
            iconColor="#4ade80"
            value={pct(metrics.failureDetectionRate)}
            label="Failure Detection Rate"
            sub={`${metrics.runsWithInjectedFaults} injected-fault run(s)`}
          />
          <StatCard
            icon={<Wrench size={20} />}
            iconBg="rgba(99,102,241,0.15)"
            iconColor="#818cf8"
            value={pct(metrics.recoverySuccessRate)}
            label="Recovery Success Rate"
            sub={`${metrics.recoveriesSucceeded}/${metrics.recoveryAttempts} attempts, ${metrics.escalations} escalated`}
          />
          <StatCard
            icon={<Timer size={20} />}
            iconBg="rgba(59,130,246,0.15)"
            iconColor="#60a5fa"
            value={metrics.mttrMs == null ? "—" : `${metrics.mttrMs} ms`}
            label="Mean Time To Recovery"
          />
          <StatCard
            icon={<Activity size={20} />}
            iconBg="rgba(168,85,247,0.15)"
            iconColor="#c084fc"
            value={`${metrics.totalRuns}`}
            label="Total Runs"
          />
          <StatCard
            icon={<Activity size={20} />}
            iconBg="rgba(239,68,68,0.15)"
            iconColor="#f87171"
            value={`${metrics.totalFailuresDetected}`}
            label="Failures Detected"
          />
          <StatCard
            icon={<ShieldCheck size={20} />}
            iconBg="rgba(34,197,94,0.15)"
            iconColor="#4ade80"
            value={`${metrics.failuresResolved}`}
            label="Failures Resolved"
          />
        </div>

        {/* Recent runs */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: "1rem" }}>
            Recent runs
          </div>
          {runs.length === 0 ? (
            <p className="text-sm text-secondary">No runs yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-secondary)" }}>
                    <th style={thStyle}>Task</th>
                    <th style={thStyle}>Injected</th>
                    <th style={thStyle}>Detected</th>
                    <th style={thStyle}>Resolved</th>
                    <th style={thStyle}>Recoveries</th>
                    <th style={thStyle}>Latency</th>
                    <th style={thStyle}>Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={tdStyle} title={r.task}>
                        {r.task.length > 42 ? r.task.slice(0, 42) + "…" : r.task}
                      </td>
                      <td style={tdStyle}>
                        {r.injectedFaults > 0 ? (
                          <span className="badge badge-medium">{r.injectedFaults}</span>
                        ) : (
                          <span className="text-secondary">—</span>
                        )}
                      </td>
                      <td style={tdStyle}>{r.detected}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            color:
                              r.detected > 0 && r.resolved === r.detected
                                ? "#4ade80"
                                : r.detected > r.resolved
                                  ? "#f87171"
                                  : "var(--text-secondary)",
                          }}
                        >
                          {r.resolved}/{r.detected}
                        </span>
                      </td>
                      <td style={tdStyle}>{r.recoveries}</td>
                      <td style={tdStyle}>{r.totalLatencyMs} ms</td>
                      <td style={tdStyle}>{r.totalTokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  fontWeight: 600,
  whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  padding: "0.55rem 0.75rem",
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
};

function BeforeAfterBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "0.35rem",
          fontSize: "0.85rem",
        }}
      >
        <span className="text-secondary">{label}</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: "var(--bg-elevated)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.round(value * 100)}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}
