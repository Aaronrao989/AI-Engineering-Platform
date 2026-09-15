/**
 * GET /api/history — list user's AI tool interactions (paginated)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const url = new URL(req.url);
  const tool = url.searchParams.get("tool") || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = 20;
  const skip = (page - 1) * limit;

  const [interactions, total] = await Promise.all([
    prisma.aIInteraction.findMany({
      where: {
        userId: session.user.id,
        ...(tool ? { tool } : {}),
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        tool: true,
        input: true,
        output: true,
        model: true,
        durationMs: true,
        createdAt: true,
      },
    }),
    prisma.aIInteraction.count({
      where: {
        userId: session.user.id,
        ...(tool ? { tool } : {}),
      },
    }),
  ]);

  return NextResponse.json({
    interactions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
