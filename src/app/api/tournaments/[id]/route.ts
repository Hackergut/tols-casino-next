import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";

// GET /api/tournaments/[id] — single tournament with full leaderboard
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.tournament.findUnique({
    where: { id },
    include: { entries: { orderBy: { wagered: "desc" } } },
  });
  if (!t) return err("Tournament not found", 404);
  return ok({
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
    leaderboard: t.entries.map((e, i) => ({
      rank: i + 1,
      username: e.username,
      wagered: e.wagered,
      wins: e.wins,
      biggestWin: e.biggestWin,
    })),
  });
}

// POST /api/tournaments/[id]/join — join tournament
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  const { id } = await params;
  const t = await db.tournament.findUnique({ where: { id } });
  if (!t) return err("Tournament not found", 404);
  if (t.status !== "active" && t.status !== "upcoming") return err("Tournament not joinable", 400);

  const existing = await db.tournamentEntry.findFirst({ where: { tournamentId: id, userId: user.id } });
  if (existing) return err("Already joined", 400);

  if (t.entryFee > 0) {
    const wallet = await db.casinoWallet.findUnique({ where: { userId: user.id } });
    if (!wallet || wallet.balance < t.entryFee) return err("Insufficient balance for entry fee", 400);
    await db.casinoWallet.update({ where: { userId: user.id }, data: { balance: { decrement: t.entryFee } } });
  }

  const entry = await db.tournamentEntry.create({
    data: {
      tournamentId: id,
      userId: user.id,
      username: user.username,
      rank: t.participantsCount + 1,
    },
  });
  await db.tournament.update({ where: { id }, data: { participantsCount: { increment: 1 } } });
  return ok({ entryId: entry.id, username: entry.username });
}
