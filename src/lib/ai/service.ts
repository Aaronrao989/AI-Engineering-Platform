/**
 * AIService — facade over the Groq API.
 *
 * All AI calls in the application go through this service.
 * The service handles:
 *   - client initialisation
 *   - model selection
 *   - request formatting
 *   - JSON parsing of structured responses
 *   - error normalisation
 */

import { getGroqClient, getModel } from "./groq";
import { SYSTEM_PROMPTS } from "./prompts";

/**
 * Per-call overrides used by the recovery engine (Step 5):
 * - `model`: run this call on a different model (model_fallback).
 * - `repairHint`: extra instruction appended to the user message (prompt_repair).
 */
export interface AiCallOptions {
  model?: string;
  repairHint?: string;
}

function applyHint(userMessage: string, opts?: AiCallOptions): string {
  return opts?.repairHint
    ? `${userMessage}\n\n[RECOVERY INSTRUCTION] ${opts.repairHint}`
    : userMessage;
}
import type {
  AnalysisResult,
  GenerationResult,
  DebugResult,
  DocumentationResult,
  ChatMessage,
} from "@/types/ai";

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Call the Groq chat completion API and return the text content of the response.
 */
async function callGroq(
  systemPrompt: string,
  userMessage: string,
  temperature = 0.3,
  maxTokens = 4096,
  modelOverride?: string
): Promise<{
  content: string;
  model: string;
  durationMs: number;
  tokens: number;
}> {
  const client = getGroqClient();
  const model = modelOverride || getModel();

  const start = Date.now();

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature,
    max_tokens: maxTokens,
  });

  const durationMs = Date.now() - start;
  const content = response.choices[0]?.message?.content ?? "";
  const tokens = response.usage?.total_tokens ?? 0;

  return { content, model, durationMs, tokens };
}

/**
 * Parse a JSON response from the model, stripping markdown fences if present.
 */
function parseJsonResponse<T>(raw: string): T {
  // Strip markdown code fences (```json ... ```)
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "");

  try {
    return JSON.parse(stripped) as T;
  } catch {
    throw new Error(
      `AI response was not valid JSON. Raw response: ${raw.slice(0, 200)}`
    );
  }
}

// ─── Public service methods ───────────────────────────────────────────────────

export const AIService = {
  /**
   * Generic text completion with a caller-supplied system prompt.
   * Used by orchestrator agents (planner/reviewer) so every LLM call in the
   * application still flows through this single service.
   */
  async complete(
    systemPrompt: string,
    userMessage: string,
    opts?: { temperature?: number; maxTokens?: number } & AiCallOptions
  ): Promise<{
    content: string;
    model: string;
    durationMs: number;
    tokens: number;
  }> {
    return callGroq(
      systemPrompt,
      applyHint(userMessage, opts),
      opts?.temperature ?? 0.3,
      opts?.maxTokens ?? 4096,
      opts?.model
    );
  },

  /**
   * Generic completion that parses the model's response as JSON.
   * Reuses the same fence-stripping + JSON.parse used by the structured tools.
   */
  async completeJson<T>(
    systemPrompt: string,
    userMessage: string,
    opts?: { temperature?: number; maxTokens?: number } & AiCallOptions
  ): Promise<{
    result: T;
    model: string;
    durationMs: number;
    tokens: number;
  }> {
    const { content, model, durationMs, tokens } = await callGroq(
      systemPrompt,
      applyHint(userMessage, opts),
      opts?.temperature ?? 0.3,
      opts?.maxTokens ?? 4096,
      opts?.model
    );
    const result = parseJsonResponse<T>(content);
    return { result, model, durationMs, tokens };
  },

  /**
   * Analyse a code snippet and return structured quality feedback.
   */
  async analyzeCode(
    code: string,
    language: string,
    opts?: AiCallOptions
  ): Promise<{
    result: AnalysisResult;
    model: string;
    durationMs: number;
    tokens: number;
  }> {
    const userMessage = `Language: ${language || "auto-detect"}\n\nCode:\n\`\`\`\n${code}\n\`\`\``;
    const { content, model, durationMs, tokens } = await callGroq(
      SYSTEM_PROMPTS.codeAnalysis,
      applyHint(userMessage, opts),
      0.3,
      4096,
      opts?.model
    );
    const result = parseJsonResponse<AnalysisResult>(content);
    return { result, model, durationMs, tokens };
  },

  /**
   * Generate code from a natural-language description.
   */
  async generateCode(
    description: string,
    language: string,
    opts?: AiCallOptions
  ): Promise<{
    result: GenerationResult;
    model: string;
    durationMs: number;
    tokens: number;
  }> {
    const userMessage = `Target language: ${language || "auto-select best language"}\n\nTask description:\n${description}`;
    const { content, model, durationMs, tokens } = await callGroq(
      SYSTEM_PROMPTS.codeGeneration,
      applyHint(userMessage, opts),
      0.4,
      4096,
      opts?.model
    );
    const result = parseJsonResponse<GenerationResult>(content);
    return { result, model, durationMs, tokens };
  },

  /**
   * Diagnose a bug and return a structured fix.
   */
  async debugCode(
    code: string,
    errorMessage: string,
    description: string,
    opts?: AiCallOptions
  ): Promise<{
    result: DebugResult;
    model: string;
    durationMs: number;
    tokens: number;
  }> {
    const parts = [
      errorMessage ? `Error message:\n${errorMessage}` : "",
      description ? `Problem description:\n${description}` : "",
      `Code:\n\`\`\`\n${code}\n\`\`\``,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { content, model, durationMs, tokens } = await callGroq(
      SYSTEM_PROMPTS.debugging,
      applyHint(parts, opts),
      0.3,
      4096,
      opts?.model
    );
    const result = parseJsonResponse<DebugResult>(content);
    return { result, model, durationMs, tokens };
  },

  /**
   * Generate documentation for a code snippet.
   */
  async generateDocumentation(
    code: string,
    language: string,
    opts?: AiCallOptions
  ): Promise<{
    result: DocumentationResult;
    model: string;
    durationMs: number;
    tokens: number;
  }> {
    const userMessage = `Language: ${language || "auto-detect"}\n\nCode:\n\`\`\`\n${code}\n\`\`\``;
    const { content, model, durationMs, tokens } = await callGroq(
      SYSTEM_PROMPTS.documentation,
      applyHint(userMessage, opts),
      0.3,
      4096,
      opts?.model
    );
    const result = parseJsonResponse<DocumentationResult>(content);
    return { result, model, durationMs, tokens };
  },

  /**
   * Conversational assistant — takes an array of chat messages.
   */
  async chat(
    messages: ChatMessage[],
    temperature = 0.7,
    opts?: AiCallOptions
  ): Promise<{
    content: string;
    model: string;
    durationMs: number;
    tokens: number;
  }> {
    const client = getGroqClient();
    const model = opts?.model || getModel();
    const start = Date.now();

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.assistant },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature,
      max_tokens: 4096,
    });

    const durationMs = Date.now() - start;
    const content = response.choices[0]?.message?.content ?? "";
    const tokens = response.usage?.total_tokens ?? 0;

    return { content, model, durationMs, tokens };
  },
};
