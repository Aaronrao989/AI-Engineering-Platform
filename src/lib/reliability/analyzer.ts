/**
 * Analyzer (Step 4 coordinator).
 *
 * Ties detection + diagnosis together: reads a run's trace, flags failures,
 * classifies each, and persists them as FailureRecord rows. Returns the
 * diagnosed failures so callers (orchestrator, CLI, dashboard) can display them.
 */

import { detectFailures } from "./detector";
import { diagnose } from "./diagnoser";
import { recordFailure } from "@/lib/observability/trace";
import type { DiagnosedFailure } from "./types";

export async function analyzeRun(
  runId: string,
  persist = true
): Promise<DiagnosedFailure[]> {
  const detected = await detectFailures(runId);
  const diagnosed = detected.map(diagnose);
  if (persist) {
    for (const d of diagnosed) await recordFailure(runId, d);
  }
  return diagnosed;
}
