/**
 * Shared TypeScript types for AI tool inputs and outputs.
 * These interfaces mirror the JSON structures defined in the system prompts.
 */

// ─── Chat / Assistant ─────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Code Analysis ────────────────────────────────────────────────────────────

export interface AnalysisResult {
  summary: string;
  language: string;
  quality: {
    score: number;
    label: string;
    rationale: string;
  };
  bugs: Array<{
    line: string;
    severity: "high" | "medium" | "low";
    description: string;
  }>;
  maintainability: {
    observations: string[];
    score: number;
  };
  improvements: Array<{
    category: string;
    suggestion: string;
  }>;
  positives: string[];
}

// ─── Code Generation ──────────────────────────────────────────────────────────

export interface GenerationResult {
  language: string;
  title: string;
  explanation: string;
  code: string;
  dependencies: string[];
  usage: string;
  notes: string[];
}

// ─── Debugging ────────────────────────────────────────────────────────────────

export interface DebugResult {
  rootCause: string;
  explanation: string;
  severity: "critical" | "high" | "medium" | "low";
  fix: {
    description: string;
    correctedCode: string;
    changes: string[];
  };
  preventionTips: string[];
}

// ─── Documentation ────────────────────────────────────────────────────────────

export interface DocumentationResult {
  overview: string;
  docstring: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
  returns: {
    type: string;
    description: string;
  } | null;
  raises: Array<{
    type: string;
    condition: string;
  }>;
  examples: Array<{
    title: string;
    code: string;
  }>;
  readmeSectionMarkdown: string;
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  model: string;
  durationMs: number;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── History ──────────────────────────────────────────────────────────────────

export interface InteractionRecord {
  id: string;
  tool: string;
  input: string;
  output: string;
  model: string;
  durationMs: number;
  createdAt: string;
}
