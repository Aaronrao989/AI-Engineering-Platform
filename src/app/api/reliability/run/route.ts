/**
 * POST /api/reliability/run
 *
 * Triggers one multi-agent run through the reliability pipeline, optionally
 * injecting faults so detection + self-healing can be demonstrated live.
 * Requires authentication. Makes real Groq API calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runAgentGraph } from "@/lib/agents/orchestrator";
import {
  normaliseAiError,
  requireString,
  ValidationError,
} from "@/lib/utils/api";
import type {
  FaultSpec,
  FaultType,
} from "@/lib/reliability/fault-injection";
import type { AgentTool } from "@/lib/agents/types";

const FAULT_TYPES: FaultType[] = [
  "tool_error",
  "timeout",
  "invalid_json",
  "model_unavailable",
  "invalid_output",
  "loop",
];
const TOOLS: AgentTool[] = ["generate", "analyze", "debug", "document"];

/** Validate + sanitise untrusted fault specs from the client. */
function parseFaults(raw: unknown): FaultSpec[] {
  if (!Array.isArray(raw)) return [];
  const out: FaultSpec[] = [];
  for (const item of raw.slice(0, 5)) {
    if (!item || typeof item !== "object") continue;
    const type = (item as { type?: unknown }).type;
    if (typeof type !== "string" || !FAULT_TYPES.includes(type as FaultType)) {
      continue;
    }
    const tool = (item as { tool?: unknown }).tool;
    const times = (item as { times?: unknown }).times;
    out.push({
      type: type as FaultType,
      tool:
        typeof tool === "string" && TOOLS.includes(tool as AgentTool)
          ? (tool as AgentTool)
          : undefined,
      times:
        typeof times === "number" && times >= 1 && times <= 3
          ? Math.floor(times)
          : 1,
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const task = requireString(body.task, "task", 4000);
    const faults = parseFaults(body.faults);

    const result = await runAgentGraph(task, {
      userId: session.user.id,
      faults,
    });

    return NextResponse.json({
      success: true,
      runId: result.runId,
      totalLatencyMs: result.totalLatencyMs,
      injectedFaults: faults.reduce((n, f) => n + (f.times ?? 1), 0),
      evaluation: result.evaluation,
      failures: result.failures.map((f) => ({
        component: f.component,
        failureType: f.failureType,
        severity: f.severity,
        category: f.category,
        suggestedStrategy: f.suggestedStrategy,
      })),
      recoveries: result.recoveries.map((r) => ({
        failureType: r.failureType,
        strategy: r.strategy,
        recovered: r.recovered,
        escalated: r.escalated,
        attempts: r.attempts,
      })),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const { message, status } = normaliseAiError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
