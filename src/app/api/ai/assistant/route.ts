/**
 * POST /api/ai/assistant
 *
 * Conversational AI assistant endpoint.
 * Accepts a messages array, returns an AI reply.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AIService } from "@/lib/ai/service";
import { prisma } from "@/lib/db/prisma";
import { normaliseAiError, ValidationError } from "@/lib/utils/api";
import type { ChatMessage } from "@/types/ai";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { messages, conversationId } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required." },
        { status: 400 }
      );
    }

    // Validate and cap message history (last 20 messages for context)
    const validMessages: ChatMessage[] = messages
      .filter(
        (m: unknown) =>
          m &&
          typeof m === "object" &&
          "role" in (m as object) &&
          "content" in (m as object)
      )
      .slice(-20);

    const { content, model, durationMs } = await AIService.chat(validMessages);

    // If a conversationId is provided, persist the latest exchange
    if (conversationId && typeof conversationId === "string") {
      const lastUserMessage = validMessages[validMessages.length - 1];
      if (lastUserMessage?.role === "user") {
        await prisma.message.create({
          data: {
            conversationId,
            role: "user",
            content: lastUserMessage.content,
          },
        });
      }
      await prisma.message.create({
        data: {
          conversationId,
          role: "assistant",
          content,
        },
      });
    }

    return NextResponse.json({ success: true, content, model, durationMs });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const { message, status } = normaliseAiError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
