/**
 * Structural / schema Verifier (Step 3).
 *
 * Deterministic, no LLM calls: checks that each agent output actually conforms
 * to the JSON shape its prompt promises. This is the structural half of the
 * reliability pipeline — it catches malformed or incomplete outputs before the
 * semantic Evaluator and the failure detector (Step 4) look at them.
 */

import type { AgentTool } from "@/lib/agents/types";

export interface VerificationResult {
  valid: boolean;
  errors: string[];
}

// ─── Small type guards ─────────────────────────────────────────────────────────

const isStr = (v: unknown): v is string => typeof v === "string";
const isNonEmptyStr = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;
const isNum = (v: unknown): v is number =>
  typeof v === "number" && !Number.isNaN(v);
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function check(errors: string[], cond: boolean, msg: string): void {
  if (!cond) errors.push(msg);
}

// ─── Per-tool worker-output validators ─────────────────────────────────────────

function verifyGenerate(o: Record<string, unknown>, e: string[]): void {
  check(e, isStr(o.language), "language must be a string");
  check(e, isStr(o.title), "title must be a string");
  check(e, isStr(o.explanation), "explanation must be a string");
  check(e, isNonEmptyStr(o.code), "code must be a non-empty string");
  check(e, isArr(o.dependencies), "dependencies must be an array");
  check(e, isStr(o.usage), "usage must be a string");
  check(e, isArr(o.notes), "notes must be an array");
}

function verifyAnalyze(o: Record<string, unknown>, e: string[]): void {
  check(e, isStr(o.summary), "summary must be a string");
  check(e, isStr(o.language), "language must be a string");
  if (isObj(o.quality)) {
    check(e, isNum(o.quality.score), "quality.score must be a number");
    check(e, isStr(o.quality.label), "quality.label must be a string");
    check(e, isStr(o.quality.rationale), "quality.rationale must be a string");
  } else {
    e.push("quality must be an object");
  }
  check(e, isArr(o.bugs), "bugs must be an array");
  if (isObj(o.maintainability)) {
    check(
      e,
      isArr(o.maintainability.observations),
      "maintainability.observations must be an array"
    );
    check(
      e,
      isNum(o.maintainability.score),
      "maintainability.score must be a number"
    );
  } else {
    e.push("maintainability must be an object");
  }
  check(e, isArr(o.improvements), "improvements must be an array");
  check(e, isArr(o.positives), "positives must be an array");
}

function verifyDebug(o: Record<string, unknown>, e: string[]): void {
  check(e, isStr(o.rootCause), "rootCause must be a string");
  check(e, isStr(o.explanation), "explanation must be a string");
  check(
    e,
    isStr(o.severity) &&
      ["critical", "high", "medium", "low"].includes(o.severity),
    "severity must be one of critical|high|medium|low"
  );
  if (isObj(o.fix)) {
    check(e, isStr(o.fix.description), "fix.description must be a string");
    check(
      e,
      isNonEmptyStr(o.fix.correctedCode),
      "fix.correctedCode must be a non-empty string"
    );
    check(e, isArr(o.fix.changes), "fix.changes must be an array");
  } else {
    e.push("fix must be an object");
  }
  check(e, isArr(o.preventionTips), "preventionTips must be an array");
}

function verifyDocument(o: Record<string, unknown>, e: string[]): void {
  check(e, isStr(o.overview), "overview must be a string");
  check(e, isStr(o.docstring), "docstring must be a string");
  check(e, isArr(o.parameters), "parameters must be an array");
  check(
    e,
    o.returns === null || isObj(o.returns),
    "returns must be an object or null"
  );
  check(e, isArr(o.raises), "raises must be an array");
  check(e, isArr(o.examples), "examples must be an array");
  check(
    e,
    isStr(o.readmeSectionMarkdown),
    "readmeSectionMarkdown must be a string"
  );
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function verifyWorkerOutput(
  tool: AgentTool,
  result: unknown
): VerificationResult {
  const errors: string[] = [];
  if (!isObj(result)) {
    return { valid: false, errors: ["output is not a JSON object"] };
  }
  switch (tool) {
    case "generate":
      verifyGenerate(result, errors);
      break;
    case "analyze":
      verifyAnalyze(result, errors);
      break;
    case "debug":
      verifyDebug(result, errors);
      break;
    case "document":
      verifyDocument(result, errors);
      break;
  }
  return { valid: errors.length === 0, errors };
}

export function verifyPlannerOutput(output: unknown): VerificationResult {
  const errors: string[] = [];
  if (!isObj(output)) return { valid: false, errors: ["plan is not an object"] };
  check(
    errors,
    isStr(output.taskUnderstanding),
    "taskUnderstanding must be a string"
  );
  if (!isArr(output.steps) || output.steps.length === 0) {
    errors.push("steps must be a non-empty array");
  } else {
    const tools = ["generate", "analyze", "debug", "document"];
    output.steps.forEach((s, i) => {
      if (!isObj(s) || !isStr(s.tool) || !tools.includes(s.tool)) {
        errors.push(`steps[${i}].tool must be one of ${tools.join("|")}`);
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

export function verifyReviewerOutput(output: unknown): VerificationResult {
  const errors: string[] = [];
  if (!isObj(output))
    return { valid: false, errors: ["review is not an object"] };
  check(
    errors,
    isStr(output.verdict) &&
      ["pass", "fail", "needs_improvement"].includes(output.verdict),
    "verdict must be one of pass|fail|needs_improvement"
  );
  check(errors, isNum(output.score), "score must be a number");
  check(errors, isStr(output.reasoning), "reasoning must be a string");
  check(errors, isArr(output.issues), "issues must be an array");
  check(errors, isArr(output.suggestions), "suggestions must be an array");
  return { valid: errors.length === 0, errors };
}
