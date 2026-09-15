/**
 * RecoveryEngine (Step 5) — the core self-healing contribution.
 *
 * Given a diagnosed failure and an `operation` that re-executes the failed work,
 * it attempts recovery according to the diagnosed strategy, under BOUNDED
 * budgets (max attempts AND max total time) so it can never loop forever:
 *   - retry:          re-run as-is, with exponential backoff between attempts.
 *   - prompt_repair:  re-run with a repair hint appended (via the operation).
 *   - model_fallback: re-run on a fallback model.
 *   - escalate:       do NOT execute; surface immediately (terminal).
 *
 * The engine is generic: the caller's `operation` decides how to apply the
 * per-attempt `model` / `repairHint` to the actual AIService call. This keeps
 * the engine pure and testable and lets the orchestrator and the failure
 * injection harness (Step 6) reuse it unchanged.
 */

import { getFallbackModel } from "@/lib/ai/groq";
import type { DiagnosedFailure, RecoveryStrategy } from "./types";

export interface RecoveryBudget {
  maxAttempts: number;
  maxTotalMs: number;
  baseBackoffMs: number;
}

export const DEFAULT_BUDGET: RecoveryBudget = {
  maxAttempts: 3,
  maxTotalMs: 60000,
  baseBackoffMs: 500,
};

/** Passed to the operation on each attempt so it can adapt its AIService call. */
export interface RecoveryAttemptOptions {
  attempt: number; // 1-based
  strategy: RecoveryStrategy;
  model?: string; // set for model_fallback
  repairHint?: string; // set for prompt_repair
}

export interface RecoveryAttemptLog {
  attempt: number;
  ok: boolean;
  ms: number;
  backoffMs: number;
  error?: string;
  model?: string;
}

export interface RecoveryOutcome<T> {
  strategy: RecoveryStrategy;
  recovered: boolean;
  escalated: boolean;
  attempts: number;
  totalMs: number;
  result?: T;
  finalError?: string;
  log: RecoveryAttemptLog[];
}

const realSleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RecoverOptions {
  budget?: Partial<RecoveryBudget>;
  /** Fallback model for model_fallback (defaults to getFallbackModel()). */
  fallbackModel?: string;
  /** Repair hint for prompt_repair (a sensible default is derived otherwise). */
  repairHint?: string;
  /** Injectable sleep so tests don't wait on real backoff. */
  sleep?: (ms: number) => Promise<void>;
}

function defaultRepairHint(failure: DiagnosedFailure): string {
  if (failure.failureType === "invalid_output") {
    return "Your previous response did not match the required schema. Respond with ONLY valid JSON in the exact structure requested, no markdown fences.";
  }
  if (failure.failureType === "review_rejected") {
    return `A reviewer rejected the previous output: ${failure.description} Regenerate a corrected, complete response.`;
  }
  return "Improve the previous response: make it correct, complete, and directly address the task.";
}

export async function recover<T>(
  failure: DiagnosedFailure,
  operation: (o: RecoveryAttemptOptions) => Promise<T>,
  opts: RecoverOptions = {}
): Promise<RecoveryOutcome<T>> {
  const budget: RecoveryBudget = { ...DEFAULT_BUDGET, ...opts.budget };
  const sleep = opts.sleep ?? realSleep;
  const strategy = failure.suggestedStrategy;
  const start = Date.now();
  const log: RecoveryAttemptLog[] = [];

  // Escalation is terminal and bounded: never execute the operation.
  if (strategy === "escalate") {
    return {
      strategy,
      recovered: false,
      escalated: true,
      attempts: 0,
      totalMs: 0,
      finalError: `Escalated without retry: ${failure.description}`,
      log,
    };
  }

  const model =
    strategy === "model_fallback"
      ? opts.fallbackModel ?? getFallbackModel()
      : undefined;
  const repairHint =
    strategy === "prompt_repair"
      ? opts.repairHint ?? defaultRepairHint(failure)
      : undefined;

  let finalError: string | undefined;

  for (let attempt = 1; attempt <= budget.maxAttempts; attempt++) {
    // Enforce the time budget before each attempt.
    if (Date.now() - start >= budget.maxTotalMs) {
      finalError = "Recovery time budget exhausted.";
      break;
    }

    const attemptStart = Date.now();
    try {
      const result = await operation({ attempt, strategy, model, repairHint });
      log.push({
        attempt,
        ok: true,
        ms: Date.now() - attemptStart,
        backoffMs: 0,
        model,
      });
      return {
        strategy,
        recovered: true,
        escalated: false,
        attempts: attempt,
        totalMs: Date.now() - start,
        result,
        log,
      };
    } catch (err) {
      finalError = err instanceof Error ? err.message : String(err);
      const isLast = attempt === budget.maxAttempts;
      // Exponential backoff, but only if a further attempt fits the time budget.
      let backoffMs = 0;
      if (!isLast) {
        backoffMs = budget.baseBackoffMs * 2 ** (attempt - 1);
        if (Date.now() - start + backoffMs >= budget.maxTotalMs) {
          log.push({
            attempt,
            ok: false,
            ms: Date.now() - attemptStart,
            backoffMs: 0,
            error: finalError,
            model,
          });
          break;
        }
      }
      log.push({
        attempt,
        ok: false,
        ms: Date.now() - attemptStart,
        backoffMs,
        error: finalError,
        model,
      });
      if (!isLast) await sleep(backoffMs);
    }
  }

  // Budget exhausted without success → escalate (bounded, cannot loop forever).
  return {
    strategy,
    recovered: false,
    escalated: true,
    attempts: log.length,
    totalMs: Date.now() - start,
    finalError,
    log,
  };
}
