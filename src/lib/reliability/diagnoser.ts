/**
 * Diagnoser (Step 4).
 *
 * Deterministically classifies each detected failure into a cause category and
 * a suggested recovery strategy that the RecoveryEngine (Step 5) will act on.
 * Exception messages are inspected so rate-limit / timeout / model-unavailable /
 * malformed-output cases get distinct, explainable diagnoses.
 */

import type {
  DetectedFailure,
  DiagnosedFailure,
  RecoveryStrategy,
  Severity,
} from "./types";

function diagnoseException(f: DetectedFailure): {
  severity: Severity;
  category: string;
  diagnosis: string;
  suggestedStrategy: RecoveryStrategy;
} {
  const msg = f.description.toLowerCase();
  if (msg.includes("rate limit") || msg.includes("429")) {
    return {
      severity: "high",
      category: "rate_limit",
      diagnosis:
        "The model API rate limit was hit; retrying with backoff usually clears it.",
      suggestedStrategy: "retry",
    };
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return {
      severity: "high",
      category: "timeout",
      diagnosis:
        "The request timed out; retry with backoff or fall back to a faster model.",
      suggestedStrategy: "retry",
    };
  }
  if (
    (msg.includes("model") &&
      (msg.includes("not found") || msg.includes("does not exist"))) ||
    msg.includes("do not have access") ||
    msg.includes("model_not_found")
  ) {
    return {
      severity: "critical",
      category: "model_unavailable",
      diagnosis:
        "The configured model is unavailable; switch to a fallback model.",
      suggestedStrategy: "model_fallback",
    };
  }
  if (msg.includes("json")) {
    return {
      severity: "high",
      category: "malformed_output",
      diagnosis:
        "The model returned non-JSON; a stricter prompt repair should fix the format.",
      suggestedStrategy: "prompt_repair",
    };
  }
  return {
    severity: "high",
    category: "runtime_or_model_error",
    diagnosis: "An unexpected runtime/model error occurred; retry the step.",
    suggestedStrategy: "retry",
  };
}

export function diagnose(f: DetectedFailure): DiagnosedFailure {
  switch (f.failureType) {
    case "exception":
      return { ...f, ...diagnoseException(f) };
    case "invalid_output":
      return {
        ...f,
        severity: "high",
        category: "schema_violation",
        diagnosis:
          "Output did not conform to the required schema; a prompt repair enforcing strict JSON should resolve it.",
        suggestedStrategy: "prompt_repair",
      };
    case "timeout":
      return {
        ...f,
        severity: "high",
        category: "performance",
        diagnosis:
          "The step exceeded its latency budget; retry with backoff or fall back to a faster model.",
        suggestedStrategy: "retry",
      };
    case "loop":
      return {
        ...f,
        severity: "critical",
        category: "control_flow",
        diagnosis:
          "Repeated or excessive steps indicate a loop; bounded escalation prevents runaway execution.",
        suggestedStrategy: "escalate",
      };
    case "low_quality":
      return {
        ...f,
        severity: "medium",
        category: "quality_degradation",
        diagnosis:
          "Semantic quality was below threshold; a targeted prompt repair or model upgrade should improve it.",
        suggestedStrategy: "prompt_repair",
      };
    case "review_rejected": {
      const isSoft = f.signal.includes("needs_improvement");
      return {
        ...f,
        severity: isSoft ? "low" : "high",
        category: "quality_rejection",
        diagnosis:
          "The reviewer rejected the output; regenerate incorporating the reviewer's feedback.",
        suggestedStrategy: "prompt_repair",
      };
    }
  }
}
