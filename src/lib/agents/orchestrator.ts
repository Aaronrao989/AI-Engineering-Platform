/**
 * Orchestrator — wires the minimal agent graph: planner → worker → reviewer.
 *
 * This is the "multi-agent system" at the heart of the project. Each agent
 * reuses AIService for its LLM calls; the orchestrator threads their outputs
 * and returns a single OrchestratorResult.
 *
 * Observability (Step 2): when `persist` is enabled, the orchestrator creates
 * an AgentRun and writes one TraceEvent per step as it completes — so a run is
 * traced incrementally and a partial trace survives even if a step throws.
 */

import { runPlanner } from "./planner";
import { runWorker } from "./worker";
import { runReviewer } from "./reviewer";
import type {
  AgentStepResult,
  OrchestratorResult,
  WorkerStepOutput,
} from "./types";
import {
  createAgentRun,
  recordTraceEvent,
  recordReliabilityEvent,
  recordErrorEvent,
  finalizeAgentRun,
} from "@/lib/observability/trace";
import {
  verifyPlannerOutput,
  verifyWorkerOutput,
  verifyReviewerOutput,
  type VerificationResult,
} from "@/lib/reliability/verifier";
import { evaluateRun, type EvaluationResult } from "@/lib/reliability/evaluator";
import { analyzeRun } from "@/lib/reliability/analyzer";
import {
  recoverRun,
  type RunRecoverySummary,
} from "@/lib/reliability/recovery-coordinator";
import type { DiagnosedFailure } from "@/lib/reliability/types";
import {
  FaultInjector,
  type FaultSpec,
} from "@/lib/reliability/fault-injection";

export interface RunOptions {
  /** Persist an AgentRun + TraceEvents. Defaults to true. */
  persist?: boolean;
  /** Owning user (nullable — CLI/experiment runs may have none). */
  userId?: string | null;
  /** Run failure detection + diagnosis after execution. Defaults to true. */
  detect?: boolean;
  /**
   * Attempt bounded self-healing on detected failures. Defaults to true.
   * On a healthy run there are no failures, so this costs nothing; disable it
   * to measure the un-healed baseline (before/after experiment, Step 8).
   */
  recover?: boolean;
  /**
   * Deliberately inject faults into the initial worker execution (Step 6), so
   * detection + recovery can be demonstrated on demand. Recovery re-runs are
   * never injected, so a clean retry/repair/fallback can succeed.
   */
  faults?: FaultSpec[];
}

export interface ReliabilityReport {
  component: string;
  result: VerificationResult;
}

export async function runAgentGraph(
  task: string,
  opts: RunOptions = {}
): Promise<
  OrchestratorResult & {
    runId: string | null;
    verifications: ReliabilityReport[];
    evaluation: EvaluationResult | null;
    failures: DiagnosedFailure[];
    recoveries: RunRecoverySummary[];
  }
> {
  const persist = opts.persist ?? true;
  const detect = opts.detect ?? true;
  const recoverEnabled = opts.recover ?? true;
  const start = Date.now();

  const injectedFaults = (opts.faults ?? []).reduce(
    (n, f) => n + (f.times ?? 1),
    0
  );
  const runId = persist
    ? await createAgentRun(task, opts.userId, injectedFaults)
    : null;
  let tokens = 0;
  const verifications: ReliabilityReport[] = [];

  // Verify one component's output structurally, record it, and remember it.
  async function verify(
    component: string,
    result: VerificationResult
  ): Promise<void> {
    verifications.push({ component, result });
    if (runId) {
      await recordReliabilityEvent(runId, {
        component: `verifier:${component}`,
        type: "verify",
        status: result.valid ? "success" : "error",
        input: { component },
        output: result,
      });
    }
  }

  try {
    // 1. Planner decomposes the task.
    const planStep = await runPlanner(task);
    tokens += planStep.tokens;
    if (runId) await recordTraceEvent(runId, "plan", planStep);
    await verify("planner", verifyPlannerOutput(planStep.output));

    // 2. Worker executes each planned step through the AI tools.
    //    A fault injector (Step 6) may fault the initial execution.
    const injector =
      opts.faults && opts.faults.length > 0
        ? new FaultInjector(opts.faults)
        : undefined;
    // A loop fault duplicates a plan step so the worker genuinely repeats it.
    const stepsToRun = injector
      ? injector.mutatePlan(planStep.output.steps)
      : planStep.output.steps;
    const workerSteps = await runWorker(stepsToRun, injector);
    for (const w of workerSteps) {
      tokens += w.tokens;
      if (runId) await recordTraceEvent(runId, "tool", w);
      // Only structurally verify steps that actually produced output; a step
      // that threw is already captured as an error event for the detector.
      if (w.status === "success") {
        await verify(
          w.component,
          verifyWorkerOutput(w.output.tool, w.output.result)
        );
      }
    }

    // 3. Reviewer critiques the worker's outputs against the task.
    const workerOutputs: WorkerStepOutput[] = workerSteps.map((s) => s.output);
    const reviewStep = await runReviewer(task, planStep.output, workerOutputs);
    tokens += reviewStep.tokens;
    if (runId) await recordTraceEvent(runId, "review", reviewStep);
    await verify("reviewer", verifyReviewerOutput(reviewStep.output));

    // 4. Evaluator scores the worker deliverables semantically (one LLM call).
    const evalStep = await evaluateRun(task, workerOutputs);
    tokens += evalStep.tokens;
    const evaluation = evalStep.result;
    if (runId) {
      await recordReliabilityEvent(runId, {
        component: "evaluator",
        type: "evaluate",
        status: "success",
        input: { task },
        output: evaluation,
        latencyMs: evalStep.durationMs,
        tokens: evalStep.tokens,
      });
    }

    const totalLatencyMs = Date.now() - start;
    if (runId) await finalizeAgentRun(runId, "success", totalLatencyMs, tokens);

    // 5. Failure detection + diagnosis over the persisted trace.
    const failures =
      runId && detect ? await analyzeRun(runId) : ([] as DiagnosedFailure[]);

    // 6. Bounded self-healing on any detected failures.
    const recoveries =
      runId && detect && recoverEnabled && failures.length > 0
        ? await recoverRun(runId)
        : ([] as RunRecoverySummary[]);

    return {
      task,
      planStep,
      workerSteps,
      reviewStep,
      totalLatencyMs,
      runId,
      verifications,
      evaluation,
      failures,
      recoveries,
    };
  } catch (error) {
    // Persist a partial trace so failures are observable too.
    if (runId) {
      await recordErrorEvent(runId, "orchestrator", error);
      await finalizeAgentRun(runId, "failed", Date.now() - start, tokens);
      // Detect + diagnose the failure so a FailureRecord exists even on throw.
      if (detect) await analyzeRun(runId);
    }
    throw error;
  }
}

// Re-export for callers that only need the step type.
export type { AgentStepResult };
