import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import {
  aggregateLeaderboard,
  LEADERBOARD_METRICS,
  periodStart,
  type LeaderboardMetric,
} from "@/lib/leaderboard-engine";

export const dynamic = "force-dynamic";

// GET /api/leaderboard?metric=wagered|wins|biggest_win|profit|high_roller
//   &period=all|daily|weekly|monthly&game=&limit=50
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawMetric = searchParams.get("metric") || "wagered";
  if (!LEADERBOARD_METRICS.includes(rawMetric as LeaderboardMetric)) {
    return err("Unknown leaderboard metric", 400);
  }
  const metric = rawMetric as LeaderboardMetric;
  const period = searchParams.get("period") || "all";
  if (!['all', 'daily', 'weekly', 'monthly'].includes(period)) return err("Unknown period", 400);
  const requestedLimit = Number(searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 50;
  const game = searchParams.get("game")?.trim() || null;
  const since = periodStart(period);

  const bets = await db.casinoBet.findMany({
    where: {
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(game ? { gameId: game } : {}),
      amount: { gt: 0 },
      result: { in: ["win", "lose", "push"] },
    },
    select: {
      userId: true,
      amount: true,
      multiplier: true,
      payout: true,
      result: true,
      createdAt: true,
      gameId: true,
      user: { select: { username: true, avatarColor: true, level: true } },
    },
  });

  const result = aggregateLeaderboard(bets, metric, limit);
  return ok({ metric, period, game, generatedAt: new Date().toISOString(), ...result });
}
