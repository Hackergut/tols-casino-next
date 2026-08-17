import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { err, getSession, ok } from "@/lib/session";
import { publicState, type BlackjackState } from "@/lib/blackjack";

export async function GET(req: NextRequest) {
  let user;
  try { user = await getSession(); } catch { return err("Sign in to play", 401); }
  const handId = new URL(req.url).searchParams.get("hand_id");
  const bet = handId
    ? await db.casinoBet.findFirst({ where: { id: handId, userId: user.id, gameId: "blackjack" } })
    : await db.casinoBet.findFirst({ where: { userId: user.id, gameId: "blackjack", result: "active" }, orderBy: { createdAt: "desc" } });
  if (!bet) return ok({ hand: null });
  const wallet = await db.casinoWallet.findUnique({ where: { userId: user.id } });
  const state = JSON.parse(bet.payload) as BlackjackState;
  return ok({ ...publicState(state, bet.id, wallet?.balance ?? 0, bet.result !== "active"), payout: bet.payout, outcome: bet.result });
}
