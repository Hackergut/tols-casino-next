import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth, hasScope } from "@/lib/platform-auth";
import { pageParams, platformOptions } from "@/lib/platform-http";

export async function GET(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "bets:read")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: bets:read" }, { status: 403 });
  }
  const url = new URL(req.url);
  const { limit, offset } = pageParams(url);
  const gameId = url.searchParams.get("gameId");
  const userId = url.searchParams.get("userId");
  const result = url.searchParams.get("result");
  const where: Record<string, unknown> = { result: { not: "pending" } };
  if (gameId) where.gameId = gameId;
  if (userId) where.userId = userId;
  if (result === "win" || result === "lose" || result === "push") where.result = result;

  const [rows, total] = await Promise.all([
    db.casinoBet.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { user: { select: { username: true, email: true } } },
    }),
    db.casinoBet.count({ where: where as never }),
  ]);

  return NextResponse.json({
    success: true,
    data: rows.map((b) => ({
      id: b.id,
      userId: b.userId,
      username: b.user?.username ?? null,
      gameId: b.gameId,
      gameName: b.gameName,
      amount: b.amount,
      multiplier: b.multiplier,
      payout: b.payout,
      result: b.result,
      createdAt: b.createdAt.toISOString(),
    })),
    pagination: { total, limit, offset, hasMore: offset + rows.length < total },
  });
}

export async function OPTIONS() {
  return platformOptions();
}
