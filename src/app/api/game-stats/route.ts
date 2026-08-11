import { db } from "@/lib/db";
import { ok } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/game-stats — per-game statistics for the dashboard
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  // Aggregate bets per game
  const bets = await db.casinoBet.findMany({
    select: {
      gameId: true,
      gameName: true,
      gameCategory: true,
      amount: true,
      multiplier: true,
      payout: true,
      result: true,
      createdAt: true,
    },
  });

  const stats = new Map<string, {
    gameId: string;
    gameName: string;
    gameCategory: string;
    betCount: number;
    totalWagered: number;
    totalPaidOut: number;
    houseProfit: number;
    wins: number;
    losses: number;
    biggestMultiplier: number;
    uniquePlayers: Set<string>;
  }>();

  // We need userId for unique players — fetch separately
  const betsWithUser = await db.casinoBet.findMany({
    select: { gameId: true, gameName: true, gameCategory: true, amount: true, multiplier: true, payout: true, result: true, userId: true },
  });

  for (const b of betsWithUser) {
    let s = stats.get(b.gameId);
    if (!s) {
      s = {
        gameId: b.gameId,
        gameName: b.gameName,
        gameCategory: b.gameCategory,
        betCount: 0,
        totalWagered: 0,
        totalPaidOut: 0,
        houseProfit: 0,
        wins: 0,
        losses: 0,
        biggestMultiplier: 0,
        uniquePlayers: new Set(),
      };
      stats.set(b.gameId, s);
    }
    s.betCount += 1;
    s.totalWagered += b.amount;
    s.totalPaidOut += b.payout;
    s.houseProfit += b.amount - b.payout;
    if (b.result === "win") {
      s.wins += 1;
      if (b.multiplier > s.biggestMultiplier) s.biggestMultiplier = b.multiplier;
    } else {
      s.losses += 1;
    }
    s.uniquePlayers.add(b.userId);
  }

  const games = Array.from(stats.values()).map((s) => ({
    gameId: s.gameId,
    gameName: s.gameName,
    gameCategory: s.gameCategory,
    betCount: s.betCount,
    totalWagered: s.totalWagered,
    totalPaidOut: s.totalPaidOut,
    houseProfit: s.houseProfit,
    houseEdge: s.totalWagered > 0 ? (s.houseProfit / s.totalWagered) * 100 : 0,
    winRate: s.betCount > 0 ? (s.wins / s.betCount) * 100 : 0,
    biggestMultiplier: s.biggestMultiplier,
    uniquePlayers: s.uniquePlayers.size,
  }));

  // Sort by total wagered desc
  games.sort((a, b) => b.totalWagered - a.totalWagered);

  // Overall totals
  const totals = {
    totalBets: games.reduce((s, g) => s + g.betCount, 0),
    totalWagered: games.reduce((s, g) => s + g.totalWagered, 0),
    totalPaidOut: games.reduce((s, g) => s + g.totalPaidOut, 0),
    houseProfit: games.reduce((s, g) => s + g.houseProfit, 0),
    totalPlayers: new Set(betsWithUser.map((b) => b.userId)).size,
  };

  return ok({ games, totals });
}
