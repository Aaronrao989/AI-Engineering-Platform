/**
 * Recovery coordinator (Step 5) — ties the pieces into end-to-end self-healing.
 *
 * For each unresolved FailureRecord on a run it:
 *   1. reconstructs the failed worker tool step from the trace,
 *   2. re-executes it via the bounded recover() primitive, applying the
 *      diagnosed strategy (retry / prompt_repair / model_fallback / escalate),
 *   3. checks the new output actually passes verification (and, for quality
 *      failures, re-evaluation) — only then is it counted as recovered,
 *   4. persists a RecoveryRecord (and marks the failure resolved on success)
 *      plus a "recovery" trace event.
 *
 * Everything is bounded: attempts per failure, wall-clock per failure, and a
 * per-run cap on how many failures are healed. It can never loop forever.
 */

import { prisma } from "@/lib/db/prisma";
import { getModel, getFallbackModel } from "@/lib/ai/groq";
import { executeToolStep } from "@/lib/agents/worker";
import type { AgentTool, PlanStep, WorkerStepOutput } from "@/lib/agents/types";
import { recover, type RecoveryOutcome } from "./recovery";
import { verifyWorkerOutput } from "./verifier";
import { evaluateRun } from "./evaluator";
import { RELIABILITY_CONFIG as CFG } from "./config";
import { recordRecovery, recordReliabilityEvent } from "@/lib/observability/trace";
import type { DiagnosedFailure, FailureType, RecoveryStrategy } from "./types";

const KNOWN_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

/** Choose a fallback model that differs from the (failing) current model. */
function pickFallbackModel(): string {
  const current = getModel();
  return KNOWN_MODELS.find((m) => m !== current) ?? getFallbackModel();
}

function safeParse(json: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Map a failure's component to the worker tool component that should be re-run. */
function targetToolComponent(
  component: string,
  toolComponents: string[]
): string | null {
  if (component.startsWith("verifier:worker:")) {
    return component.slice("verifier:".length); // -> worker:<tool>
  }
  if (component.startsWith("worker:")) return component;
  // evaluator / reviewer failures target the primary worker deliverable.
  if (component === "evaluator" || component === "reviewer") {
    return (
      toolComponents.find((c) => c === "worker:generate") ??
      toolComponents[0] ??
      null
    );
  }
  return null;
}

export interface RunRecoverySummary {
  failureId: string;
  failureType: FailureType;
  component: string;
  strategy: RecoveryStrategy;
  recovered: boolean;
  escalated: boolean;
  attempts: number;
  totalMs: number;
  tokens: number;
  finalError?: string;
}

export async function recoverRun(
  runId: string
): Promise<RunRecoverySummary[]> {
  const failures = await prisma.failureRecord.findMany({
    where: { runId, resolved: false },
    orderBy: { createdAt: "asc" },
    take: CFG.recovery.maxRecoveriesPerRun,
  });
  if (failures.length === 0) return [];

  const run = await prisma.agentRun.findUnique({ where: { id: runId } });
  const task = run?.task ?? "";

  const events = await prisma.traceEvent.findMany({
    where: { runId, type: "tool" },
    orderBy: { timestamp: "asc" },
  });
  const toolComponents = events.map((e) => e.component);

  const budget = {
    maxAttempts: CFG.recovery.maxAttemptsPerFailure,
    maxTotalMs: CFG.recovery.maxTotalMsPerFailure,
    baseBackoffMs: CFG.recovery.baseBackoffMs,
  };
  const fallbackModel = pickFallbackModel();

  const summaries: RunRecoverySummary[] = [];

  for (const f of failures) {
    const diagnosed: DiagnosedFailure = {
      component: f.component,
      failureType: f.failureType as FailureType,
      signal: f.signal,
      description: f.description,
      severity: f.severity as DiagnosedFailure["severity"],
      category: f.category,
      diagnosis: f.diagnosis,
      suggestedStrategy: f.suggestedStrategy as RecoveryStrategy,
    };

    let tokensSpent = 0;
    let outcome: RecoveryOutcome<{ output: WorkerStepOutput }>;

    if (diagnosed.suggestedStrategy === "escalate") {
      // Bounded, terminal: recover() escalates without executing anything.
      outcome = await recover<{ output: WorkerStepOutput }>(
        diagnosed,
        async () => {
          throw new Error("unreachable");
        },
        { budget }
      );
    } else {
      const targetComp = targetToolComponent(f.component, toolComponents);
      const targetEventIdx = targetComp
        ? events.map((e) => e.component).lastIndexOf(targetComp)
        : -1;
      const targetEvent = targetEventIdx >= 0 ? events[targetEventIdx] : null;
      const step = targetEvent
        ? (safeParse(targetEvent.input) as PlanStep | null)
        : null;

      if (!step || !step.tool) {
        // Nothing to re-execute → record a bounded escalation with a reason.
        outcome = {
          strategy: diagnosed.suggestedStrategy,
          recovered: false,
          escalated: true,
          attempts: 0,
          totalMs: 0,
          finalError:
            "No reconstructable operation for this failure; escalated.",
          log: [],
        };
      } else {
        // Reconstruct code carried from an earlier generate/debug step.
        let carriedCode: string | null = step.code ?? null;
        if (!carriedCode) {
          for (let i = targetEventIdx - 1; i >= 0; i--) {
            const out = safeParse(events[i].output);
            const inner = out?.result as Record<string, unknown> | undefined;
            const code =
              (inner?.code as string) ??
              ((inner?.fix as Record<string, unknown>)
                ?.correctedCode as string) ??
              null;
            if (code) {
              carriedCode = code;
              break;
            }
          }
        }

        const tool = step.tool as AgentTool;
        const needsSemantic =
          diagnosed.failureType === "low_quality" ||
          diagnosed.failureType === "review_rejected";

        outcome = await recover<{ output: WorkerStepOutput }>(
          diagnosed,
          async (o) => {
            const res = await executeToolStep(step, carriedCode, {
              model: o.model,
              repairHint: o.repairHint,
            });
            tokensSpent += res.tokens;

            const v = verifyWorkerOutput(tool, res.output.result);
            if (!v.valid) {
              throw new Error(
                `Recovered output still invalid: ${v.errors.join("; ")}`
              );
            }
            if (needsSemantic) {
              const ev = await evaluateRun(task, [res.output]);
              tokensSpent += ev.tokens;
              if (ev.result.overall < CFG.lowQualityThreshold) {
                throw new Error(
                  `Recovered output still low quality (overall ${ev.result.overall}).`
                );
              }
            }
            return { output: res.output };
          },
          { budget, fallbackModel }
        );
      }
    }

    // Persist RecoveryRecord (+ resolve the failure on success).
    await recordRecovery(runId, f.id, outcome);
    await recordReliabilityEvent(runId, {
      component: `recovery:${f.component}`,
      type: "recovery",
      status: outcome.recovered ? "success" : "error",
      input: { failureType: f.failureType, strategy: outcome.strategy },
      output: {
        recovered: outcome.recovered,
        escalated: outcome.escalated,
        attempts: outcome.attempts,
        finalError: outcome.finalError ?? null,
      },
      latencyMs: outcome.totalMs,
      tokens: tokensSpent,
    });

    summaries.push({
      failureId: f.id,
      failureType: f.failureType as FailureType,
      component: f.component,
      strategy: outcome.strategy,
      recovered: outcome.recovered,
      escalated: outcome.escalated,
      attempts: outcome.attempts,
      totalMs: outcome.totalMs,
      tokens: tokensSpent,
      finalError: outcome.finalError,
    });
  }

  return summaries;
}
