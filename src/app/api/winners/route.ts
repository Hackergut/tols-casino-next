import { NextResponse } from "next/server";

/*
 * GET /api/winners — recent big wins for the marquee.
 *
 * Used to be hardcoded demo data, which meant the marquee celebrated players
 * who do not exist — the exact kind of fabrication a trust surface cannot
 * carry. It now reads real settled wins, filtered by the same thresholds the
 * live `winner:new` broadcast applies (public-feed.ts), so a win that scrolls
 * past in the marquee and one that arrives over SSE are the same population.
 *
 * Same privacy rule as the bet feed: username + avatarColor only.
 */

export const dynamic = "force-dynamic";

const MIN_PAYOUT = 500;
const MIN_MULTIPLIER = 5;

export async function GET() {
  try {
    // Lazy import: Prisma init failure degrades to an empty marquee instead
    // of a hard 500 on a decorative endpoint.
    const { db } = await import("@/lib/db");

    const wins = await db.casinoBet.findMany({
      where: {
        result: "win",
        payout: { gte: MIN_PAYOUT },
        multiplier: { gte: MIN_MULTIPLIER },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        gameName: true,
        amount: true,
        multiplier: true,
        payout: true,
        createdAt: true,
        user: { select: { username: true, avatarColor: true } },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: wins.map((w) => ({
          id: w.id,
          username: w.user?.username ?? "anonymous",
          avatarColor: w.user?.avatarColor ?? "#cdf32b",
          gameName: w.gameName,
          amount: w.amount,
          multiplier: w.multiplier,
          payout: w.payout,
          createdAt: w.createdAt.toISOString(),
        })),
      },
      {
        // Short shared cache: the marquee repairs itself over SSE anyway.
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
      },
    );
  } catch {
    // Empty marquee, never a broken page.
    return NextResponse.json({ success: true, data: [] });
  }
}
