/**
 * POST /api/ai/document
 *
 * Accepts code + language, returns structured documentation.
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
    const code = requireString(body.code, "code");
    const language = optionalString(body.language, "auto-detect");

    const { result, model, durationMs } = await AIService.generateDocumentation(
      code,
      language
    );

    await prisma.aIInteraction.create({
      data: {
        userId: session.user.id,
        tool: "document",
        input: JSON.stringify({ code, language }),
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
