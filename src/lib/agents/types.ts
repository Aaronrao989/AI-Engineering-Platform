/**
 * Shared types for the multi-agent orchestrator (planner → worker → reviewer).
 *
 * Design note: every agent step is captured as an `AgentStepResult`, which
 * already carries the fields the observability layer (Step 2) will persist as a
 * TraceEvent — `component`, `input`, `output`, `model`, `latencyMs`, `status`.
 * That way Step 2 is additive (wrap each call site) rather than a refactor.
 */

// ─── Tools the worker can invoke (reuses the existing five AI tools) ────────────

export type AgentTool = "generate" | "analyze" | "debug" | "document";

// ─── Planner ────────────────────────────────────────────────────────────────

/** A single step the worker should execute, decided by the planner. */
export interface PlanStep {
  tool: AgentTool;
  rationale: string;
  /** Target language (generate/analyze/document). Optional. */
  language?: string;
  /** Natural-language description (generate/debug). Optional. */
  description?: string;
  /** Code to operate on (analyze/debug/document). May be omitted to reuse the
   *  code produced by an earlier generate/debug step. */
  code?: string;
  /** Error message for the debug tool. Optional. */
  errorMessage?: string;
}

export interface PlannerOutput {
  taskUnderstanding: string;
  steps: PlanStep[];
}

// ─── Worker ─────────────────────────────────────────────────────────────────

/** Output of executing one plan step through the AIService tool layer. */
export interface WorkerStepOutput {
  tool: AgentTool;
  /** The structured result returned by the underlying AIService tool method. */
  result: unknown;
}

// ─── Reviewer ────────────────────────────────────────────────────────────────

export type ReviewVerdict = "pass" | "fail" | "needs_improvement";

export interface ReviewerOutput {
  verdict: ReviewVerdict;
  /** Quality score 0–10 for the worker's output against the task. */
  score: number;
  reasoning: string;
  issues: string[];
  suggestions: string[];
}

// ─── Per-step trace (foundation for Step 2 observability) ──────────────────────

export interface AgentStepResult<T> {
  /** e.g. "planner", "worker:generate", "reviewer". */
  component: string;
  input: unknown;
  output: T;
  model: string;
  latencyMs: number;
  /** Total tokens (prompt + completion) reported by the model for this step. */
  tokens: number;
  status: "success" | "error";
}

// ─── Orchestrator result ───────────────────────────────────────────────────────

export interface OrchestratorResult {
  task: string;
  planStep: AgentStepResult<PlannerOutput>;
  workerSteps: Array<AgentStepResult<WorkerStepOutput>>;
  reviewStep: AgentStepResult<ReviewerOutput>;
  totalLatencyMs: number;
}
