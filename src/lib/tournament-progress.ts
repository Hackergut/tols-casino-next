import { db } from "@/lib/db";

/**
 * Project a settled real-money bet into every joined active tournament that
 * accepts the game. Tournament rows remain a materialised leaderboard for fast
 * reads, while CasinoBet stays the source of truth.
 */
export async function syncTournamentProgress(
  userId: string,
  gameId: string,
  stake: number,
  result: { won: boolean; payout: number },
): Promise<void> {
  if (!(stake > 0) || !Number.isFinite(stake) || !Number.isFinite(result.payout)) return;
  const now = new Date();
  const entries = await db.tournamentEntry.findMany({
    where: {
      userId,
      tournament: {
        status: "active",
        startDate: { lte: now },
        endDate: { gt: now },
        OR: [{ game: "all" }, { game: gameId }],
      },
    },
    select: { id: true, biggestWin: true },
  });

  await Promise.all(entries.map((entry) => db.tournamentEntry.update({
    where: { id: entry.id },
    data: {
      wagered: { increment: stake },
      wins: result.won ? { increment: 1 } : undefined,
      biggestWin: result.won && result.payout > entry.biggestWin ? result.payout : undefined,
    },
  })));
}
