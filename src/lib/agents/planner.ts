/**
 * Planner agent — turns a task string into an ordered plan of tool steps.
 * Uses AIService.completeJson so the call flows through the shared LLM layer.
 */

import { AIService } from "@/lib/ai/service";
import { AGENT_PROMPTS } from "./prompts";
import type { AgentStepResult, PlannerOutput } from "./types";

export async function runPlanner(
  task: string
): Promise<AgentStepResult<PlannerOutput>> {
  const input = { task };
  const { result, model, durationMs, tokens } =
    await AIService.completeJson<PlannerOutput>(
      AGENT_PROMPTS.planner,
      `Task:\n${task}`
    );

  return {
    component: "planner",
    input,
    output: result,
    model,
    latencyMs: durationMs,
    tokens,
    status: "success",
  };
}
