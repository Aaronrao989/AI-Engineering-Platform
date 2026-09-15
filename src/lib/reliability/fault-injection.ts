/**
 * Failure-injection harness (Step 6).
 *
 * Injects REAL faults into the live execution path so detection (Step 4) and
 * self-healing (Step 5) can be demonstrated on demand. An injector is scoped to
 * a single run and only wraps the INITIAL worker execution — the recovery
 * coordinator re-runs steps without an injector, so a clean retry/repair/
 * fallback can succeed. That is what produces the fail → detect → heal story.
 *
 * Fault types:
 *   - tool_error:        the tool call throws a generic failure (before spending tokens).
 *   - timeout:           the tool call throws a timeout error.
 *   - invalid_json:      mimics the real parseJsonResponse failure (non-JSON reply).
 *   - model_unavailable: mimics the real Groq "model does not exist" 404.
 *   - invalid_output:    the call succeeds but its output is corrupted so it fails
 *                        structural verification (schema violation).
 */

import type { AgentTool, PlanStep, WorkerStepOutput } from "@/lib/agents/types";
import { RELIABILITY_CONFIG as CFG } from "./config";

export type FaultType =
  | "tool_error"
  | "timeout"
  | "invalid_json"
  | "model_unavailable"
  | "invalid_output"
  | "loop"; // plan-level: duplicate a step so the worker really repeats it

export interface FaultSpec {
  /** Restrict to one tool; omit to match any tool. */
  tool?: AgentTool;
  type: FaultType;
  /** How many matching calls to fault before passing through. Default 1. */
  times?: number;
}

/** Faults thrown BEFORE the model call (no tokens spent). */
const THROW_BEFORE: Record<string, string | undefined> = {
  tool_error: "Injected tool failure: the tool crashed during execution.",
  timeout: "The AI request timed out. Please try again.",
  invalid_json:
    "AI response was not valid JSON. Raw response: <injected non-JSON reply>",
  model_unavailable:
    "The model `injected/model` does not exist or you do not have access to it.",
};

export class FaultInjector {
  private counts: number[];

  constructor(private specs: FaultSpec[]) {
    this.counts = specs.map(() => 0);
  }

  private matchIndex(tool: AgentTool, predicate: (t: FaultType) => boolean): number {
    for (let i = 0; i < this.specs.length; i++) {
      const s = this.specs[i];
      if ((s.tool == null || s.tool === tool) && predicate(s.type)) {
        if (this.counts[i] < (s.times ?? 1)) return i;
      }
    }
    return -1;
  }

  /**
   * Mutate the plan before execution (loop fault): duplicate the targeted step
   * enough times to exceed the loop detector's threshold, so the worker really
   * repeats it and the run produces genuine duplicate trace events.
   */
  mutatePlan(steps: PlanStep[]): PlanStep[] {
    // Find an unconsumed loop spec (match on any tool if spec.tool is unset).
    for (let s = 0; s < this.specs.length; s++) {
      const spec = this.specs[s];
      if (spec.type !== "loop" || this.counts[s] >= (spec.times ?? 1)) continue;
      const targetIdx = spec.tool
        ? steps.findIndex((st) => st.tool === spec.tool)
        : 0;
      if (targetIdx < 0 || steps.length === 0) continue;
      this.counts[s]++;
      const copies = CFG.duplicateStepLimit + 1; // one more than allowed
      const target = steps[targetIdx];
      const repeated: PlanStep[] = Array.from({ length: copies }, () => ({
        ...target,
      }));
      return [
        ...steps.slice(0, targetIdx),
        ...repeated,
        ...steps.slice(targetIdx + 1),
      ];
    }
    return steps;
  }

  /** Called before the real tool call — may throw to simulate a failure. */
  beforeCall(tool: AgentTool): void {
    const i = this.matchIndex(tool, (t) => t in THROW_BEFORE);
    if (i === -1) return;
    this.counts[i]++;
    throw new Error(THROW_BEFORE[this.specs[i].type]!);
  }

  /** Called after the real tool call — may corrupt the output (invalid_output). */
  afterCall(tool: AgentTool, output: WorkerStepOutput): WorkerStepOutput {
    const i = this.matchIndex(tool, (t) => t === "invalid_output");
    if (i === -1) return output;
    this.counts[i]++;
    // Blank a required field so structural verification fails.
    const corrupted = {
      ...(output.result as Record<string, unknown>),
    } as Record<string, unknown>;
    if (tool === "generate" || tool === "debug") corrupted.code = "";
    else if (tool === "analyze") corrupted.summary = 123; // wrong type
    else if (tool === "document") corrupted.overview = 123;
    return { tool: output.tool, result: corrupted };
  }

  /** Total faults injected so far (for reporting). */
  get injected(): number {
    return this.counts.reduce((a, b) => a + b, 0);
  }
}
