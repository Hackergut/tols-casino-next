import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/game-stats/[gameId] — detailed stats for a single game
export async function GET(req: NextRequest, { params }: { params: Promise<{ gameId: string }> }) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { gameId } = await params;

  const bets = await db.casinoBet.findMany({
    where: { gameId },
    select: {
      amount: true,
      multiplier: true,
      payout: true,
      result: true,
      userId: true,
      createdAt: true,
      user: { select: { username: true, avatarColor: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  if (bets.length === 0) return err("No bets found for this game", 404);

  const totalBets = bets.length;
  const totalWagered = bets.reduce((s, b) => s + b.amount, 0);
  const totalPaidOut = bets.reduce((s, b) => s + b.payout, 0);
  const houseProfit = totalWagered - totalPaidOut;
  const wins = bets.filter((b) => b.result === "win");
  const winRate = (wins.length / totalBets) * 100;
  const houseEdge = totalWagered > 0 ? (houseProfit / totalWagered) * 100 : 0;

  // Top 5 biggest multipliers
  const topMultipliers = [...bets]
    .filter((b) => b.multiplier > 0)
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, 5)
    .map((b) => ({
      username: b.user?.username || "Player",
      avatarColor: b.user?.avatarColor || "#ccff00",
      multiplier: b.multiplier,
      payout: b.payout,
      amount: b.amount,
      createdAt: b.createdAt.toISOString(),
    }));

  // Bet size distribution (buckets)
  const buckets = [
    { label: "<$1", min: 0, max: 1, count: 0 },
    { label: "$1-10", min: 1, max: 10, count: 0 },
    { label: "$10-50", min: 10, max: 50, count: 0 },
    { label: "$50-100", min: 50, max: 100, count: 0 },
    { label: "$100-500", min: 100, max: 500, count: 0 },
    { label: "$500+", min: 500, max: Infinity, count: 0 },
  ];
  for (const b of bets) {
    for (const bucket of buckets) {
      if (b.amount >= bucket.min && b.amount < bucket.max) {
        bucket.count++;
        break;
      }
    }
  }

  // Unique players
  const uniquePlayers = new Set(bets.map((b) => b.userId)).size;

  // Recent bets (last 15)
  const recentBets = bets.slice(0, 15).map((b) => ({
    username: b.user?.username || "Player",
    avatarColor: b.user?.avatarColor || "#ccff00",
    amount: b.amount,
    multiplier: b.multiplier,
    payout: b.payout,
    result: b.result,
    createdAt: b.createdAt.toISOString(),
  }));

  // Get game info
  const game = await db.casinoGame.findFirst({ where: { alias: gameId } });

  return ok({
    game: game ? {
      name: game.name,
      provider: game.provider,
      category: game.category,
      rtp: game.rtp,
      volatility: game.volatility,
      imageUrl: game.imageUrl,
      description: game.description,
    } : { name: gameId, provider: "Unknown", category: "originals", rtp: 99, volatility: "medium", imageUrl: "", description: "" },
    stats: {
      totalBets,
      totalWagered,
      totalPaidOut,
      houseProfit,
      houseEdge,
      winRate,
      wins: wins.length,
      losses: totalBets - wins.length,
      uniquePlayers,
      biggestMultiplier: topMultipliers[0]?.multiplier || 0,
    },
    topMultipliers,
    betDistribution: buckets.map((b) => ({ label: b.label, count: b.count })),
    recentBets,
  });
}
