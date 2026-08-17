import {
  aggregateLeaderboard,
  nextPeriodBoundary,
  periodStart,
  type LeaderboardBet,
  type LeaderboardMetric,
} from "@/lib/leaderboard-engine";

export const dynamic = "force-dynamic";

const BOARD_DEFS: Array<{
  id: string;
  title: string;
  subtitle: string;
  metric: LeaderboardMetric;
  period: "daily" | "weekly" | "monthly";
  prizePool: number;
}> = [
  { id: "weekly-race", title: "Weekly Wager Race", subtitle: "Total real-money wager volume", metric: "wagered", period: "weekly", prizePool: 100_000 },
  { id: "daily-winners", title: "Daily Winners", subtitle: "Most winning rounds today", metric: "wins", period: "daily", prizePool: 5_000 },
  { id: "high-rollers", title: "High Roller Sprint", subtitle: "Largest single stake this week", metric: "high_roller", period: "weekly", prizePool: 25_000 },
  { id: "biggest-wins", title: "Biggest Wins", subtitle: "Largest payout this week", metric: "biggest_win", period: "weekly", prizePool: 15_000 },
  { id: "monthly-profit", title: "Monthly Profit Masters", subtitle: "Net payout minus wager volume", metric: "profit", period: "monthly", prizePool: 50_000 },
];

export async function GET() {
  try {
    // Lazy imports keep this optional lobby surface fail-soft when Prisma cannot
    // initialise. A static db import throws before GET's catch can respond.
    const [{ db }, { getCurrentUser }] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/auth"),
    ]);
    const now = new Date();
    const monthStart = periodStart("monthly", now)!;
    const [bets, recentBets, tournaments, jackpot, viewer] = await Promise.all([
      db.casinoBet.findMany({
        where: { createdAt: { gte: monthStart }, amount: { gt: 0 } },
        select: {
          userId: true, amount: true, multiplier: true, payout: true, result: true,
          createdAt: true, gameId: true,
          user: { select: { username: true, avatarColor: true, level: true } },
        },
      }),
      db.casinoBet.findMany({
        where: { amount: { gt: 0 } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true, gameId: true, gameName: true, amount: true, multiplier: true,
          payout: true, result: true, currency: true, createdAt: true,
          user: { select: { username: true, avatarColor: true } },
        },
      }),
      db.tournament.findMany({
        where: { status: { in: ["active", "upcoming"] }, endDate: { gt: now } },
        orderBy: [{ status: "asc" }, { startDate: "asc" }],
        take: 6,
        include: { entries: { orderBy: [{ wagered: "desc" }, { wins: "desc" }], take: 10 } },
      }),
      db.globalJackpot.findUnique({ where: { id: "global" } }).catch(() => null),
      getCurrentUser().catch(() => null),
    ]);

    const typedBets = bets as LeaderboardBet[];
    const boards = BOARD_DEFS.map((definition) => {
      const since = periodStart(definition.period, now)!;
      const periodBets = typedBets.filter((bet) => bet.createdAt >= since);
      const result = aggregateLeaderboard(periodBets, definition.metric, Math.max(1, periodBets.length));
      const viewerEntry = viewer
        ? result.leaderboard.find((entry) => entry.userId === viewer.id) ?? null
        : null;
      return {
        ...definition,
        startsAt: since.toISOString(),
        endsAt: nextPeriodBoundary(definition.period, now).toISOString(),
        totalPlayers: result.total,
        entries: result.leaderboard.slice(0, 50),
        viewer: viewerEntry,
      };
    });

    const mapBet = (bet: (typeof recentBets)[number]) => ({
      id: bet.id,
      gameId: bet.gameId,
      gameName: bet.gameName,
      username: bet.user?.username ?? "Anonymous",
      avatarColor: bet.user?.avatarColor ?? "#cdf32b",
      amount: bet.amount,
      multiplier: bet.multiplier,
      payout: bet.payout,
      result: bet.result,
      currency: bet.currency,
      createdAt: bet.createdAt.toISOString(),
    });

    return Response.json({
      success: true,
      data: {
        generatedAt: now.toISOString(),
      refreshAfterMs: 15_000,
      jackpot: jackpot?.amount ?? 0,
      promotions: boards.map((board) => ({
        id: board.id,
        title: board.title,
        description: board.subtitle,
        prizePool: board.prizePool,
        currency: "USDT",
        leaderboardId: board.id,
        endsAt: board.endsAt,
        playerRank: board.viewer?.rank ?? null,
        playerScore: board.viewer ? scoreFor(board.metric, board.viewer) : null,
      })),
      boards,
      liveBets: recentBets.slice(0, 20).map(mapBet),
      highRollerBets: [...recentBets]
        .sort((a, b) => b.amount - a.amount || b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 20)
        .map(mapBet),
      tournaments: tournaments.map((tournament) => ({
        id: tournament.id,
        name: tournament.name,
        game: tournament.game,
        prizePool: tournament.prizePool,
        entryFee: tournament.entryFee,
        startDate: tournament.startDate.toISOString(),
        endDate: tournament.endDate.toISOString(),
        status: tournament.status,
        participantsCount: tournament.participantsCount,
        maxParticipants: tournament.maxParticipants,
        description: tournament.description,
        currency: tournament.currency,
        leaderboard: tournament.entries.map((entry, index) => ({
          rank: index + 1,
          username: entry.username,
          wagered: entry.wagered,
          wins: entry.wins,
          biggestWin: entry.biggestWin,
        })),
        })),
      },
    });
  } catch {
    // Leaderboards enrich the lobby; a database issue must not make the casino
    // shell unavailable. The UI renders a recoverable empty state and retries.
    return Response.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(), refreshAfterMs: 15_000, jackpot: 0,
        promotions: [], boards: [], liveBets: [], highRollerBets: [], tournaments: [],
      },
    });
  }
}

function scoreFor(metric: LeaderboardMetric, entry: {
  wagered: number; wins: number; biggestBet: number; biggestWin: number; netProfit: number;
}) {
  if (metric === "wins") return entry.wins;
  if (metric === "high_roller") return entry.biggestBet;
  if (metric === "biggest_win") return entry.biggestWin;
  if (metric === "profit") return entry.netProfit;
  return entry.wagered;
}
