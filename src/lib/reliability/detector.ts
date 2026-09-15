/**
 * FailureDetector (Step 4).
 *
 * Reads the persisted trace for a run and flags abnormal events using
 * deterministic rules. Detection is decoupled from execution: it reads the
 * TraceEvent rows the observability layer wrote, so it works on live runs,
 * historical runs, and injected-failure runs (Step 6) alike.
 */

import { prisma } from "@/lib/db/prisma";
import { RELIABILITY_CONFIG as CFG } from "./config";
import type { DetectedFailure } from "./types";

function safeParse(json: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function detectFailures(
  runId: string
): Promise<DetectedFailure[]> {
  const events = await prisma.traceEvent.findMany({
    where: { runId },
    orderBy: { timestamp: "asc" },
  });

  const failures: DetectedFailure[] = [];

  for (const e of events) {
    // Invalid output: a verification step that failed structurally.
    if (e.type === "verify" && e.status === "error") {
      const out = safeParse(e.output);
      const errs = Array.isArray(out?.errors) ? (out!.errors as string[]) : [];
      failures.push({
        component: e.component,
        failureType: "invalid_output",
        signal: "verifier status=error",
        description: `Structural verification failed: ${errs.join("; ") || "schema mismatch"}`,
      });
    } else if (e.status === "error" || e.type === "error") {
      // Exception: any other error-status / error-type event. The message may be
      // top-level (recordErrorEvent) or nested under result.error (worker step).
      const out = safeParse(e.output);
      const nested = out?.result as Record<string, unknown> | undefined;
      const message =
        (out?.error as string) ??
        (nested?.error as string) ??
        "unknown error";
      failures.push({
        component: e.component,
        failureType: "exception",
        signal: "event status=error",
        description: `Exception: ${message}`,
      });
    }

    // Timeout: a step slower than the latency budget.
    if (e.latencyMs > CFG.latencyTimeoutMs) {
      failures.push({
        component: e.component,
        failureType: "timeout",
        signal: `latencyMs=${e.latencyMs} > ${CFG.latencyTimeoutMs}`,
        description: `Step exceeded the latency budget (${e.latencyMs}ms).`,
      });
    }
  }

  // Low quality: evaluator overall below threshold.
  const evalEvent = events.find((e) => e.type === "evaluate");
  if (evalEvent) {
    const out = safeParse(evalEvent.output);
    const overall = typeof out?.overall === "number" ? out.overall : null;
    if (overall !== null && overall < CFG.lowQualityThreshold) {
      failures.push({
        component: "evaluator",
        failureType: "low_quality",
        signal: `overall=${overall} < ${CFG.lowQualityThreshold}`,
        description: `Evaluator judged the output low quality (overall ${overall}/10).`,
      });
    }
  }

  // Review rejected: the in-graph reviewer did not pass the output.
  const reviewEvent = events.find((e) => e.type === "review");
  if (reviewEvent) {
    const out = safeParse(reviewEvent.output);
    const verdict = out?.verdict;
    if (verdict === "fail") {
      failures.push({
        component: "reviewer",
        failureType: "review_rejected",
        signal: "verdict=fail",
        description: "Reviewer rejected the output.",
      });
    } else if (verdict === "needs_improvement") {
      failures.push({
        component: "reviewer",
        failureType: "review_rejected",
        signal: "verdict=needs_improvement",
        description: "Reviewer flagged the output as needing improvement.",
      });
    }
  }

  // Loop: too many tool steps, or the same step repeated.
  const toolEvents = events.filter((e) => e.type === "tool");
  if (toolEvents.length > CFG.maxToolSteps) {
    failures.push({
      component: "worker",
      failureType: "loop",
      signal: `toolSteps=${toolEvents.length} > ${CFG.maxToolSteps}`,
      description: `Worker executed an abnormal number of steps (${toolEvents.length}).`,
    });
  }
  const seen = new Map<string, number>();
  for (const e of toolEvents) {
    const key = `${e.component}:${e.input}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n === CFG.duplicateStepLimit + 1) {
      failures.push({
        component: e.component,
        failureType: "loop",
        signal: `identical step repeated ${n} times`,
        description: `Identical worker step repeated ${n} times (possible loop).`,
      });
    }
  }

  return failures;
}
