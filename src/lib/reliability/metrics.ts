/**
 * Reliability metrics (Step 7).
 *
 * Computes the paper's KPIs directly from the persisted tables — no fabricated
 * numbers, every value is derived from real AgentRun / FailureRecord /
 * RecoveryRecord rows. Metrics are scoped to one user's runs.
 *
 * Definitions (kept explicit so the paper can cite them):
 *  - Task Success Rate (before healing): runs with ZERO detected failures / all runs.
 *  - Task Success Rate (after healing):  runs with ZERO UNRESOLVED failures / all runs.
 *  - Failure Detection Rate: of runs with injected faults, the fraction where at
 *    least one failure was detected (injected faults are the ground truth).
 *  - Recovery Success Rate: recovered recovery attempts / all recovery attempts.
 *  - Mean Time To Recovery: mean wall-clock of successful recovery attempts (ms).
 */

import { prisma } from "@/lib/db/prisma";

export interface ReliabilityMetrics {
  totalRuns: number;
  runsWithInjectedFaults: number;
  taskSuccessRateBefore: number; // 0..1
  taskSuccessRateAfter: number; // 0..1
  reliabilityGain: number; // after - before (percentage points as 0..1)
  failureDetectionRate: number | null; // null when no injected-fault runs yet
  totalFailuresDetected: number;
  failuresResolved: number;
  recoveryAttempts: number;
  recoveriesSucceeded: number;
  escalations: number;
  recoverySuccessRate: number | null;
  mttrMs: number | null;
}

type RunAgg = { injectedFaults: number; failures: { resolved: boolean }[] };
type RecAgg = { recovered: boolean; escalated: boolean; totalMs: number };

/** Pure aggregation of runs + recoveries into the KPI set. */
function aggregate(runs: RunAgg[], recoveries: RecAgg[]): ReliabilityMetrics {
  let successBefore = 0;
  let successAfter = 0;
  let injectedRuns = 0;
  let injectedDetected = 0;
  let totalDetected = 0;
  let resolved = 0;

  for (const r of runs) {
    const detected = r.failures.length;
    const unresolved = r.failures.filter((f) => !f.resolved).length;
    totalDetected += detected;
    resolved += detected - unresolved;
    if (detected === 0) successBefore++;
    if (unresolved === 0) successAfter++;
    if (r.injectedFaults > 0) {
      injectedRuns++;
      if (detected > 0) injectedDetected++;
    }
  }

  const recoveryAttempts = recoveries.length;
  const recoveriesSucceeded = recoveries.filter((r) => r.recovered).length;
  const escalations = recoveries.filter((r) => r.escalated).length;
  const recoveredMs = recoveries
    .filter((r) => r.recovered)
    .map((r) => r.totalMs);
  const mttrMs = recoveredMs.length
    ? Math.round(recoveredMs.reduce((a, b) => a + b, 0) / recoveredMs.length)
    : null;

  const totalRuns = runs.length;
  const taskSuccessRateBefore = totalRuns ? successBefore / totalRuns : 0;
  const taskSuccessRateAfter = totalRuns ? successAfter / totalRuns : 0;

  return {
    totalRuns,
    runsWithInjectedFaults: injectedRuns,
    taskSuccessRateBefore,
    taskSuccessRateAfter,
    reliabilityGain: taskSuccessRateAfter - taskSuccessRateBefore,
    failureDetectionRate: injectedRuns ? injectedDetected / injectedRuns : null,
    totalFailuresDetected: totalDetected,
    failuresResolved: resolved,
    recoveryAttempts,
    recoveriesSucceeded,
    escalations,
    recoverySuccessRate: recoveryAttempts
      ? recoveriesSucceeded / recoveryAttempts
      : null,
    mttrMs,
  };
}

/** Aggregate KPIs over a specific set of runs (used by the experiment harness). */
export async function computeMetricsForRunIds(
  ids: string[]
): Promise<ReliabilityMetrics> {
  if (ids.length === 0) return aggregate([], []);
  const runs = await prisma.agentRun.findMany({
    where: { id: { in: ids } },
    select: { injectedFaults: true, failures: { select: { resolved: true } } },
  });
  const recoveries = await prisma.recoveryRecord.findMany({
    where: { runId: { in: ids } },
    select: { recovered: true, escalated: true, totalMs: true },
  });
  return aggregate(runs, recoveries);
}

export async function computeMetrics(
  userId: string
): Promise<ReliabilityMetrics> {
  const runs = await prisma.agentRun.findMany({
    where: { userId },
    select: {
      injectedFaults: true,
      failures: { select: { resolved: true } },
    },
  });
  const recoveriesForUser = await prisma.recoveryRecord.findMany({
    where: { run: { userId } },
    select: { recovered: true, escalated: true, totalMs: true },
  });
  return aggregate(runs, recoveriesForUser);
}


export interface RecentRun {
  id: string;
  task: string;
  status: string;
  injectedFaults: number;
  totalLatencyMs: number;
  totalTokens: number;
  createdAt: string;
  detected: number;
  resolved: number;
  recoveries: number;
}

export async function listRecentRuns(
  userId: string,
  limit = 12
): Promise<RecentRun[]> {
  const runs = await prisma.agentRun.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      task: true,
      status: true,
      injectedFaults: true,
      totalLatencyMs: true,
      totalTokens: true,
      createdAt: true,
      failures: { select: { resolved: true } },
      _count: { select: { recoveries: true } },
    },
  });

  return runs.map((r) => ({
    id: r.id,
    task: r.task,
    status: r.status,
    injectedFaults: r.injectedFaults,
    totalLatencyMs: r.totalLatencyMs,
    totalTokens: r.totalTokens,
    createdAt: r.createdAt.toISOString(),
    detected: r.failures.length,
    resolved: r.failures.filter((f) => f.resolved).length,
    recoveries: r._count.recoveries,
  }));
}
