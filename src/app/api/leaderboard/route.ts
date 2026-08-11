import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/session";

// GET /api/leaderboard?metric=wagered|wins|biggest_win&period=all|weekly|monthly&limit=50
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const metric = searchParams.get("metric") || "wagered";
  const period = searchParams.get("period") || "all";
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 50));

  // Build date filter
  let dateFilter: Date | null = null;
  if (period === "weekly") dateFilter = new Date(Date.now() - 7 * 86400000);
  else if (period === "monthly") dateFilter = new Date(Date.now() - 30 * 86400000);
  else if (period === "daily") dateFilter = new Date(Date.now() - 86400000);

  const where = dateFilter ? { createdAt: { gt: dateFilter } } : {};

  // Aggregate bets per user
  const bets = await db.casinoBet.findMany({
    where,
    select: {
      userId: true,
      amount: true,
      multiplier: true,
      payout: true,
      result: true,
      user: { select: { username: true, avatarColor: true, level: true } },
    },
  });

  const stats = new Map<string, {
    userId: string;
    username: string;
    avatarColor: string;
    level: number;
    wagered: number;
    wins: number;
    losses: number;
    biggestWin: number;
    totalWon: number;
    betCount: number;
  }>();

  for (const b of bets) {
    if (!b.user) continue;
    let s = stats.get(b.userId);
    if (!s) {
      s = {
        userId: b.userId,
        username: b.user.username,
        avatarColor: b.user.avatarColor,
        level: b.user.level,
        wagered: 0,
        wins: 0,
        losses: 0,
        biggestWin: 0,
        totalWon: 0,
        betCount: 0,
      };
      stats.set(b.userId, s);
    }
    s.wagered += b.amount;
    s.betCount += 1;
    if (b.result === "win") {
      s.wins += 1;
      s.totalWon += b.payout;
      if (b.payout > s.biggestWin) s.biggestWin = b.payout;
    } else {
      s.losses += 1;
    }
  }

  let arr = Array.from(stats.values());
  if (metric === "wagered") arr.sort((a, b) => b.wagered - a.wagered);
  else if (metric === "wins") arr.sort((a, b) => b.wins - a.wins);
  else if (metric === "biggest_win") arr.sort((a, b) => b.biggestWin - a.biggestWin);
  else if (metric === "profit") arr.sort((a, b) => (b.totalWon - b.wagered) - (a.totalWon - a.wagered));

  arr = arr.slice(0, limit).map((s, i) => ({ ...s, rank: i + 1, netProfit: s.totalWon - s.wagered }));

  return ok({
    metric,
    period,
    total: stats.size,
    leaderboard: arr,
  });
}
