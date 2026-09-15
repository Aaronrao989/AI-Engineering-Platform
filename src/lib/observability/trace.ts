/**
 * Observability persistence (Step 2).
 *
 * Turns the in-memory AgentStepResult records produced by the orchestrator into
 * durable AgentRun + TraceEvent rows. This is the trace store that the later
 * reliability layers (verify / evaluate / detect / recover) read from.
 */

import { prisma } from "@/lib/db/prisma";
import type { AgentStepResult } from "@/lib/agents/types";
import type { DiagnosedFailure } from "@/lib/reliability/types";
import type { RecoveryOutcome } from "@/lib/reliability/recovery";

/** Create the run row and return its id. status starts as "running". */
export async function createAgentRun(
  task: string,
  userId?: string | null,
  injectedFaults = 0
): Promise<string> {
  const run = await prisma.agentRun.create({
    data: { task, userId: userId ?? null, injectedFaults },
  });
  return run.id;
}

/**
 * Persist one agent step as a TraceEvent. `type` classifies the event
 * ("plan" | "tool" | "review" | "error") for the observability views.
 */
export async function recordTraceEvent(
  runId: string,
  type: string,
  step: AgentStepResult<unknown>
): Promise<void> {
  await prisma.traceEvent.create({
    data: {
      runId,
      component: step.component,
      type,
      status: step.status,
      input: JSON.stringify(step.input),
      output: JSON.stringify(step.output),
      latencyMs: step.latencyMs,
      tokens: step.tokens,
    },
  });
}

/**
 * Record a reliability-pipeline event (verify / evaluate) into the trace.
 * These have no single "model call" shape, so they take explicit fields.
 */
export async function recordReliabilityEvent(
  runId: string,
  params: {
    component: string;
    type: string;
    status: "success" | "error";
    input: unknown;
    output: unknown;
    latencyMs?: number;
    tokens?: number;
  }
): Promise<void> {
  await prisma.traceEvent.create({
    data: {
      runId,
      component: params.component,
      type: params.type,
      status: params.status,
      input: JSON.stringify(params.input),
      output: JSON.stringify(params.output),
      latencyMs: params.latencyMs ?? 0,
      tokens: params.tokens ?? 0,
    },
  });
}

/** Record a free-form error event (used when a step throws before returning). */
export async function recordErrorEvent(
  runId: string,
  component: string,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.traceEvent.create({
    data: {
      runId,
      component,
      type: "error",
      status: "error",
      input: JSON.stringify({}),
      output: JSON.stringify({ error: message }),
      latencyMs: 0,
      tokens: 0,
    },
  });
}

/** Persist a diagnosed failure and return its id. */
export async function recordFailure(
  runId: string,
  f: DiagnosedFailure
): Promise<string> {
  const rec = await prisma.failureRecord.create({
    data: {
      runId,
      component: f.component,
      failureType: f.failureType,
      severity: f.severity,
      signal: f.signal,
      description: f.description,
      category: f.category,
      diagnosis: f.diagnosis,
      suggestedStrategy: f.suggestedStrategy,
    },
  });
  return rec.id;
}

/**
 * Persist a recovery attempt and, if it succeeded, mark its target failure
 * resolved. Returns the RecoveryRecord id.
 */
export async function recordRecovery(
  runId: string,
  failureId: string | null,
  outcome: RecoveryOutcome<unknown>
): Promise<string> {
  const rec = await prisma.recoveryRecord.create({
    data: {
      runId,
      failureId: failureId ?? null,
      strategy: outcome.strategy,
      attempts: outcome.attempts,
      recovered: outcome.recovered,
      escalated: outcome.escalated,
      totalMs: outcome.totalMs,
      finalError: outcome.finalError ?? null,
      detail: JSON.stringify(outcome.log),
    },
  });
  if (outcome.recovered && failureId) {
    await prisma.failureRecord.update({
      where: { id: failureId },
      data: { resolved: true },
    });
  }
  return rec.id;
}

/** Close out a run: set terminal status and aggregate latency/tokens. */
export async function finalizeAgentRun(
  runId: string,
  status: "success" | "failed",
  totalLatencyMs: number,
  totalTokens: number
): Promise<void> {
  await prisma.agentRun.update({
    where: { id: runId },
    data: { status, totalLatencyMs, totalTokens },
  });
}
