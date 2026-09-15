/**
 * POST /api/ai/generate
 *
 * Accepts a task description + optional language, returns generated code.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AIService } from "@/lib/ai/service";
import { prisma } from "@/lib/db/prisma";
import {
  normaliseAiError,
  requireString,
  optionalString,
  ValidationError,
} from "@/lib/utils/api";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const description = requireString(body.description, "description");
    const language = optionalString(body.language, "");

    const { result, model, durationMs } = await AIService.generateCode(
      description,
      language
    );

    await prisma.aIInteraction.create({
      data: {
        userId: session.user.id,
        tool: "generate",
        input: JSON.stringify({ description, language }),
        output: JSON.stringify(result),
        model,
        durationMs,
      },
    });

    return NextResponse.json({ success: true, data: result, model, durationMs });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const { message, status } = normaliseAiError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
