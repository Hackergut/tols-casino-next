import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { evLaunch, evPlayerToken } from "@/lib/eurovirtuals";

/*
 * Start a EuroVirtuals game for the signed-in player (operator → provider).
 * We mint a player token that names the TOLS user (their callbacks echo it
 * back so we can resolve the player), then ask EuroVirtuals for the iframe URL.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return err("Sign in to play", 401);

  const b = await req.json().catch(() => null);
  const gameUuid = String(b?.game_uuid ?? b?.gameUuid ?? "");
  if (!gameUuid) return err("game_uuid required", 400);

  const wallet = await db.casinoWallet.findUnique({ where: { userId: user.id }, select: { balance: true, currency: true } });

  const res = await evLaunch({
    playerId: user.id,
    playerName: user.username,
    playerToken: evPlayerToken(user.id),
    gameUuid,
    currency: wallet?.currency ?? "USD",
    balance: wallet?.balance ?? 0,
    demo: b?.demo === 1 ? 1 : 0,
    device: b?.device === "mobile" ? "mobile" : "web",
    country: b?.country ? String(b.country) : undefined,
    language: b?.language ? String(b.language) : undefined,
  });

  if ("error" in res) return err(res.error, 502);
  return ok({ url: res.url });
}
