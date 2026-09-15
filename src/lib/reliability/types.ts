/**
 * Shared types for the failure-detection + diagnosis layer (Step 4).
 */

export type FailureType =
  | "exception" // a step threw / reported an error status
  | "invalid_output" // structural verification failed
  | "timeout" // a step exceeded the latency budget
  | "loop" // repeated / excessive steps
  | "low_quality" // evaluator score below threshold
  | "review_rejected"; // in-graph reviewer rejected the output

export type Severity = "critical" | "high" | "medium" | "low";

export type RecoveryStrategy =
  | "retry" // retry with backoff
  | "prompt_repair" // regenerate with a corrected/stricter prompt
  | "model_fallback" // switch to a different model
  | "escalate"; // stop and surface for human/bounded escalation

/** A failure flagged by the detector, before diagnosis. */
export interface DetectedFailure {
  component: string;
  failureType: FailureType;
  /** The concrete signal that triggered detection (for the paper/trace). */
  signal: string;
  description: string;
}

/** A failure after the diagnoser has classified its cause. */
export interface DiagnosedFailure extends DetectedFailure {
  severity: Severity;
  category: string;
  diagnosis: string;
  suggestedStrategy: RecoveryStrategy;
}
