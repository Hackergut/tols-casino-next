import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok } from "@/lib/session";

// GET /api/bets/history?game=&result=&limit=&skip=
export async function GET(req: NextRequest) {
  const user = await getSession();
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game");
  const result = searchParams.get("result");
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 50));
  const skip = Number(searchParams.get("skip") ?? 0);

  const where: Record<string, unknown> = { userId: user.id };
  if (game) where.gameId = game;
  if (result === "win" || result === "lose" || result === "push") where.result = result;
  else where.result = { in: ["win", "lose", "push"] };

  const [bets, total] = await Promise.all([
    db.casinoBet.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    db.casinoBet.count({ where }),
  ]);

  return ok({
    total,
    bets: bets.map((b) => ({
      id: b.id,
      gameId: b.gameId,
      gameName: b.gameName,
      gameCategory: b.gameCategory,
      amount: b.amount,
      multiplier: b.multiplier,
      payout: b.payout,
      result: b.result,
      clientSeed: b.clientSeed,
      serverSeedHash: b.serverSeedHash,
      nonce: b.nonce,
      createdAt: b.createdAt.toISOString(),
    })),
  });
}
