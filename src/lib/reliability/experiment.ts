/**
 * Before/after reliability experiment (Step 8).
 *
 * Runs the SAME set of trials (task + injected faults) under two conditions:
 *   - baseline: detection ON, recovery OFF  (no self-healing)
 *   - healing:  detection ON, recovery ON   (autonomous self-healing)
 *
 * The only difference between conditions is whether the RecoveryEngine runs, so
 * the delta in Task Success Rate is attributable to self-healing. Every number
 * comes from real execution — nothing is fabricated.
 */

import { runAgentGraph } from "@/lib/agents/orchestrator";
import {
  computeMetricsForRunIds,
  type ReliabilityMetrics,
} from "./metrics";
import type { FaultSpec } from "./fault-injection";

export interface Trial {
  label: string;
  task: string;
  faults: FaultSpec[];
}

export interface ConditionResult {
  condition: "baseline" | "healing";
  runIds: string[];
  metrics: ReliabilityMetrics;
}

export interface ExperimentResult {
  startedAt: string;
  finishedAt: string;
  trialCount: number;
  repetitions: number;
  totalRuns: number;
  baseline: ConditionResult;
  healing: ConditionResult;
}

export interface ExperimentOptions {
  repetitions?: number; // how many times to run each trial per condition
  userId?: string | null; // attribute runs to a user (default null = CLI experiment)
  onProgress?: (msg: string) => void;
}

async function runCondition(
  condition: "baseline" | "healing",
  trials: Trial[],
  repetitions: number,
  userId: string | null,
  onProgress?: (msg: string) => void
): Promise<ConditionResult> {
  const runIds: string[] = [];
  for (let rep = 0; rep < repetitions; rep++) {
    for (const trial of trials) {
      const r = await runAgentGraph(trial.task, {
        faults: trial.faults,
        recover: condition === "healing",
        userId,
      });
      if (r.runId) runIds.push(r.runId);
      onProgress?.(
        `[${condition}] rep ${rep + 1}/${repetitions} · ${trial.label}: ` +
          `${r.failures.length} detected, ` +
          `${r.recoveries.filter((x) => x.recovered).length} recovered`
      );
    }
  }
  return {
    condition,
    runIds,
    metrics: await computeMetricsForRunIds(runIds),
  };
}

export async function runExperiment(
  trials: Trial[],
  opts: ExperimentOptions = {}
): Promise<ExperimentResult> {
  const repetitions = opts.repetitions ?? 1;
  const userId = opts.userId ?? null;
  const startedAt = new Date().toISOString();

  // Baseline first, then healing — same trials, same injected faults.
  const baseline = await runCondition(
    "baseline",
    trials,
    repetitions,
    userId,
    opts.onProgress
  );
  const healing = await runCondition(
    "healing",
    trials,
    repetitions,
    userId,
    opts.onProgress
  );

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    trialCount: trials.length,
    repetitions,
    totalRuns: baseline.runIds.length + healing.runIds.length,
    baseline,
    healing,
  };
}

/** The default trial set: one healthy control + representative fault scenarios. */
export const DEFAULT_TRIALS: Trial[] = [
  {
    label: "healthy (control)",
    task: "Write a function that reverses a string.",
    faults: [],
  },
  {
    label: "model_unavailable",
    task: "Write a function that reverses a string.",
    faults: [{ tool: "generate", type: "model_unavailable" }],
  },
  {
    label: "invalid_output",
    task: "Write a function that checks if a number is prime.",
    faults: [{ tool: "generate", type: "invalid_output" }],
  },
  {
    label: "tool_error",
    task: "Write a function that returns the nth Fibonacci number.",
    faults: [{ tool: "generate", type: "tool_error" }],
  },
  {
    label: "loop (escalation)",
    task: "Write a function that reverses a string.",
    faults: [{ tool: "generate", type: "loop" }],
  },
];
