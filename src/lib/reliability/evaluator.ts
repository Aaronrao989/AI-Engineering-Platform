/**
 * Semantic Evaluator (Step 3).
 *
 * A lightweight LLM judge that scores the worker's deliverables against the
 * task on three dimensions (relevance, completeness, correctness). It runs once
 * per run (one Groq call) and is independent of the in-graph reviewer: its
 * numeric scores are a reliability signal the failure detector (Step 4) can
 * threshold on. The overall score is computed here (mean of the three
 * dimensions) rather than taken from the model, so it can't be fabricated.
 */

import { AIService } from "@/lib/ai/service";
import type { WorkerStepOutput } from "@/lib/agents/types";

/** Sub-scores returned by the judge model (each 0–10). */
interface EvaluatorModelOutput {
  relevance: number;
  completeness: number;
  correctness: number;
  reasoning: string;
}

export interface EvaluationResult {
  relevance: number;
  completeness: number;
  correctness: number;
  /** Deterministic mean of the three dimensions, rounded to 1 decimal. */
  overall: number;
  reasoning: string;
}

const EVALUATOR_PROMPT = `You are the EVALUATOR in an AI reliability pipeline.
Given a task and the outputs a worker produced for it, judge output QUALITY —
not formatting. Score three dimensions from 0 to 10:
- relevance: does the output address the task that was asked?
- completeness: does it fully cover what the task requires?
- correctness: is the content accurate and free of errors/hallucination?

Respond with a structured JSON object ONLY — no markdown, no text outside JSON:
{
  "relevance": 8,
  "completeness": 7,
  "correctness": 9,
  "reasoning": "One or two sentences justifying the scores"
}
Be strict and specific. Respond with the JSON object only.`;

function clamp10(n: unknown): number {
  const v = typeof n === "number" && !Number.isNaN(n) ? n : 0;
  return Math.max(0, Math.min(10, v));
}

export async function evaluateRun(
  task: string,
  workerOutputs: WorkerStepOutput[]
): Promise<{
  result: EvaluationResult;
  model: string;
  durationMs: number;
  tokens: number;
}> {
  const userMessage = [
    `Task:\n${task}`,
    `Worker outputs:\n${JSON.stringify(workerOutputs, null, 2)}`,
  ].join("\n\n");

  const { result, model, durationMs, tokens } =
    await AIService.completeJson<EvaluatorModelOutput>(
      EVALUATOR_PROMPT,
      userMessage
    );

  const relevance = clamp10(result.relevance);
  const completeness = clamp10(result.completeness);
  const correctness = clamp10(result.correctness);
  const overall =
    Math.round(((relevance + completeness + correctness) / 3) * 10) / 10;

  return {
    result: {
      relevance,
      completeness,
      correctness,
      overall,
      reasoning: typeof result.reasoning === "string" ? result.reasoning : "",
    },
    model,
    durationMs,
    tokens,
  };
}
