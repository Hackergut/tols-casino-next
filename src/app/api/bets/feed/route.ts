import { NextRequest } from "next/server";

/*
 * GET /api/bets/feed?tab=latest|high|mine&game=&limit=
 *
 * The public bet feed under every game — the "My Bets / Latest Bets / High
 * Rollers" table the Originals framework calls for. It is a trust surface:
 * seeing other people's losses scroll past is what makes the wins credible.
 *
 * Deliberately NOT importing getSession(): that pulls Prisma in at module
 * scope and this route must stay renderable for logged-out visitors. The
 * "mine" tab resolves the viewer lazily and degrades to an empty list rather
 * than failing the whole request.
 *
 * Usernames are the only identifying field exposed, which is what the player
 * already publishes by betting. No ids, no emails, no balances.
 */

export const dynamic = "force-dynamic";

type Tab = "latest" | "high" | "mine";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = (searchParams.get("tab") ?? "latest") as Tab;
    const game = searchParams.get("game");
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 10)));

    // Imported lazily so a Prisma initialisation failure is caught by this
    // handler's own try/catch. A static import throws at module load, before
    // GET runs, which turns a degraded feed into a hard 500 on the route.
    const { db } = await import("@/lib/db");

    const where: Record<string, unknown> = {};
    if (game) where.gameId = game;

    if (tab === "high") {
      // High rollers is by stake, not by payout: a big win on a $1 bet is
      // luck, a big stake is the thing other players actually react to.
      where.amount = { gt: 0 };
    }

    if (tab === "mine") {
      const userId = await currentUserId();
      if (!userId) return Response.json({ success: true, data: { bets: [] } });
      where.userId = userId;
    }

    const bets = await db.casinoBet.findMany({
      where,
      orderBy: tab === "high" ? [{ amount: "desc" }, { createdAt: "desc" }] : { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        gameId: true,
        gameName: true,
        amount: true,
        multiplier: true,
        payout: true,
        result: true,
        currency: true,
        createdAt: true,
        user: { select: { username: true, avatarColor: true } },
      },
    });

    return Response.json({
      success: true,
      data: {
        bets: bets.map((b) => ({
          id: b.id,
          gameId: b.gameId,
          gameName: b.gameName,
          username: b.user?.username ?? "anonymous",
          avatarColor: b.user?.avatarColor ?? "#cdf32b",
          amount: b.amount,
          multiplier: b.multiplier,
          payout: b.payout,
          result: b.result,
          currency: b.currency,
          createdAt: b.createdAt.toISOString(),
        })),
      },
    });
  } catch {
    // A broken feed must never take the game down with it.
    return Response.json({ success: true, data: { bets: [] } });
  }
}

/** Resolve the viewer without importing the Prisma-heavy session module. */
async function currentUserId(): Promise<string | null> {
  try {
    const { getSession } = await import("@/lib/session");
    const user = await getSession();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
