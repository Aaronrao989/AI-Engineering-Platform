/**
 * GET  /api/conversations         — list user's conversations
 * POST /api/conversations         — create a new conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title : "New Conversation";

  const conversation = await prisma.conversation.create({
    data: {
      userId: session.user.id,
      title,
    },
  });

  return NextResponse.json({ conversation }, { status: 201 });
}
