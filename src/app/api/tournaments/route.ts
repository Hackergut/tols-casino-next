import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/session";

// GET /api/tournaments?status=active
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const tournaments = await db.tournament.findMany({
    where,
    orderBy: { startDate: "asc" },
    include: { entries: { orderBy: { wagered: "desc" }, take: 50 } },
  });

  return ok(
    tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      game: t.game,
      prizePool: t.prizePool,
      entryFee: t.entryFee,
      startDate: t.startDate.toISOString(),
      endDate: t.endDate.toISOString(),
      status: t.status,
      participantsCount: t.participantsCount,
      maxParticipants: t.maxParticipants,
      description: t.description,
      currency: t.currency,
      bannerColor: t.bannerColor,
      leaderboard: t.entries.slice(0, 20).map((e, i) => ({
        rank: i + 1,
        username: e.username,
        wagered: e.wagered,
        wins: e.wins,
        biggestWin: e.biggestWin,
      })),
    }))
  );
}
