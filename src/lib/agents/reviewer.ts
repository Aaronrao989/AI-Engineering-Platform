/**
 * Reviewer agent — judges whether the worker's outputs satisfy the task.
 * Uses AIService.completeJson so the call flows through the shared LLM layer.
 */

import { AIService } from "@/lib/ai/service";
import { AGENT_PROMPTS } from "./prompts";
import type {
  AgentStepResult,
  PlannerOutput,
  ReviewerOutput,
  WorkerStepOutput,
} from "./types";

export async function runReviewer(
  task: string,
  plan: PlannerOutput,
  workerOutputs: WorkerStepOutput[]
): Promise<AgentStepResult<ReviewerOutput>> {
  const input = { task, plan, workerOutputs };

  const userMessage = [
    `Original task:\n${task}`,
    `Plan followed:\n${JSON.stringify(plan, null, 2)}`,
    `Worker outputs:\n${JSON.stringify(workerOutputs, null, 2)}`,
  ].join("\n\n");

  const { result, model, durationMs, tokens } =
    await AIService.completeJson<ReviewerOutput>(
      AGENT_PROMPTS.reviewer,
      userMessage
    );

  return {
    component: "reviewer",
    input,
    output: result,
    model,
    latencyMs: durationMs,
    tokens,
    status: "success",
  };
}
