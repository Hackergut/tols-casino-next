import { db } from "@/lib/db";
import { ok } from "@/lib/session";

// GET /api/stats — platform stats (bets count, wagered, house profit, online players)
export async function GET() {
  const [betCount, houseAgg, jackpot] = await Promise.all([
    db.casinoBet.count(),
    db.houseEarning.aggregate({ _sum: { houseProfit: true, wager: true }, _count: true }),
    db.globalJackpot.findUnique({ where: { id: "global" } }),
  ]);

  // online players — mock based on recent bets
  const recent = await db.casinoBet.findMany({
    where: { createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) } },
    distinct: ["userId"],
    take: 100,
  });

  const res = ok({
    totalBets: betCount,
    totalWagered: houseAgg._sum.wager || 0,
    houseProfit: houseAgg._sum.houseProfit || 0,
    jackpot: jackpot?.amount || 0,
    onlinePlayers: recent.length + 1247, // base mock + active
    totalPlayers: 84213,
  });
  // Public aggregate, polled every 30s by every client — short edge cache.
  res.headers.set("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
  return res;
}
