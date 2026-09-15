/**
 * Worker agent — executes each plan step by invoking the existing AI tools
 * through AIService. Threads code forward: a step that operates on code but
 * doesn't supply its own reuses the code produced by the most recent
 * generate/debug step.
 */

import { AIService, type AiCallOptions } from "@/lib/ai/service";
import { getModel } from "@/lib/ai/groq";
import type { AgentStepResult, PlanStep, WorkerStepOutput } from "./types";
import type { GenerationResult, DebugResult } from "@/types/ai";
import type { FaultInjector } from "@/lib/reliability/fault-injection";

/** Pull runnable code out of a generate/debug result so later steps can reuse it. */
function extractCode(tool: string, result: unknown): string | null {
  if (tool === "generate") {
    return (result as GenerationResult)?.code ?? null;
  }
  if (tool === "debug") {
    return (result as DebugResult)?.fix?.correctedCode ?? null;
  }
  return null;
}

type ToolExecution = {
  output: WorkerStepOutput;
  model: string;
  durationMs: number;
  tokens: number;
};

/**
 * Execute a single plan step through the AI tools.
 *
 * `carriedCode` supplies the code for analyze/debug/document steps that don't
 * carry their own. `opts` (model / repairHint) is forwarded to AIService so the
 * RecoveryEngine (Step 5) can re-run a step on a fallback model or with a
 * prompt-repair hint. `injector` (Step 6) may fault the call before it runs or
 * corrupt its output afterwards. Exported so the recovery coordinator reuses it
 * verbatim (it never passes an injector, so recovery re-runs are clean).
 */
export async function executeToolStep(
  step: PlanStep,
  carriedCode: string | null,
  opts?: AiCallOptions,
  injector?: FaultInjector
): Promise<ToolExecution> {
  injector?.beforeCall(step.tool); // may throw to simulate a failure
  const base = await callTool(step, carriedCode, opts);
  const output = injector ? injector.afterCall(step.tool, base.output) : base.output;
  return { ...base, output };
}

async function callTool(
  step: PlanStep,
  carriedCode: string | null,
  opts?: AiCallOptions
): Promise<ToolExecution> {
  const language = step.language ?? "auto-detect";

  switch (step.tool) {
    case "generate": {
      const { result, model, durationMs, tokens } =
        await AIService.generateCode(step.description ?? "", language, opts);
      return { output: { tool: "generate", result }, model, durationMs, tokens };
    }
    case "analyze": {
      const code = step.code ?? carriedCode ?? "";
      const { result, model, durationMs, tokens } =
        await AIService.analyzeCode(code, language, opts);
      return { output: { tool: "analyze", result }, model, durationMs, tokens };
    }
    case "debug": {
      const code = step.code ?? carriedCode ?? "";
      const { result, model, durationMs, tokens } = await AIService.debugCode(
        code,
        step.errorMessage ?? "",
        step.description ?? "",
        opts
      );
      return { output: { tool: "debug", result }, model, durationMs, tokens };
    }
    case "document": {
      const code = step.code ?? carriedCode ?? "";
      const { result, model, durationMs, tokens } =
        await AIService.generateDocumentation(code, language, opts);
      return { output: { tool: "document", result }, model, durationMs, tokens };
    }
  }
}

export async function runWorker(
  steps: PlanStep[],
  injector?: FaultInjector
): Promise<Array<AgentStepResult<WorkerStepOutput>>> {
  const results: Array<AgentStepResult<WorkerStepOutput>> = [];
  let carriedCode: string | null = null;

  for (const step of steps) {
    const started = Date.now();
    try {
      const { output, model, durationMs, tokens } = await executeToolStep(
        step,
        carriedCode,
        undefined,
        injector
      );

      const newCode = extractCode(step.tool, output.result);
      if (newCode) carriedCode = newCode;

      results.push({
        component: `worker:${step.tool}`,
        input: step,
        output,
        model,
        latencyMs: durationMs,
        tokens,
        status: "success",
      });
    } catch (err) {
      // A failed step must NOT abort the run — capture it so it can be detected
      // and recovered. The PlanStep is preserved as input so recovery can re-run it.
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        component: `worker:${step.tool}`,
        input: step,
        output: { tool: step.tool, result: { error: message } },
        model: getModel(),
        latencyMs: Date.now() - started,
        tokens: 0,
        status: "error",
      });
    }
  }

  return results;
}
