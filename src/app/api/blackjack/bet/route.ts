import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { err, getSession, ok } from "@/lib/session";
import { getActiveSeed, nextNonce } from "@/lib/provably-fair";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import {
  BLACKJACK_MAX_BET, BLACKJACK_MIN_BET, draw, isBlackjack, publicState,
  settle, type BlackjackState,
} from "@/lib/blackjack";
import { shuffledShoe } from "@/lib/blackjack-server";

export async function POST(req: NextRequest) {
  const limited = await rateLimit("bet", LIMITS.bet);
  if (limited) return limited;
  let user;
  try { user = await getSession(); } catch { return err("Sign in to play", 401); }
  const body = await req.json().catch(() => null) as { bet?: number; clientSeed?: string } | null;
  const amount = Math.round(Number(body?.bet) * 100) / 100;
  if (!Number.isFinite(amount) || amount < BLACKJACK_MIN_BET || amount > BLACKJACK_MAX_BET) return err(`Bet must be between ${BLACKJACK_MIN_BET} and ${BLACKJACK_MAX_BET}`, 400);

  const wallet = await db.casinoWallet.findUnique({ where: { userId: user.id } });
  if (!wallet || Math.round(wallet.balance * 100) < Math.round(amount * 100)) return err("Insufficient balance", 400);

  const seed = await getActiveSeed(user.id);
  const nonce = await nextNonce(seed.id);
  const clientSeed = body?.clientSeed?.slice(0, 64) || seed.clientSeed;
  const deck = shuffledShoe(seed.serverSeed, clientSeed, nonce);
  const state: BlackjackState = {
    version: 1, deck, dealer: [], hands: [{ cards: [], bet: amount, status: "active" }], activeHand: 0,
    originalBet: amount, insurance: 0, insuranceResolved: false, splitUsed: false, phase: "player",
    serverSeedHash: seed.serverSeedHash, clientSeed, nonce, createdAt: new Date().toISOString(),
  };
  state.hands[0].cards.push(draw(state));
  state.dealer.push(draw(state)); // hole card
  state.hands[0].cards.push(draw(state));
  state.dealer.push(draw(state)); // up card

  // Dealer peeks under a ten. An ace first offers insurance; declining it via
  // any normal action performs the peek in the action endpoint.
  const dealerBj = isBlackjack(state.dealer);
  const playerBj = isBlackjack(state.hands[0].cards);
  let settlement: ReturnType<typeof settle> | null = null;
  if (state.dealer[1].rank !== "A" && (dealerBj || playerBj)) settlement = settle(state);

  const payload = JSON.stringify(state);
  const created = await db.$transaction(async (tx) => {
    const debited = await tx.casinoWallet.updateMany({ where: { userId: user.id, balance: { gte: amount } }, data: { balance: { decrement: amount }, totalWagered: { increment: amount } } });
    if (debited.count !== 1) throw new Error("INSUFFICIENT_BALANCE");
    if (settlement?.payout) await tx.casinoWallet.update({ where: { userId: user.id }, data: { balance: { increment: settlement.payout }, totalWon: { increment: settlement.payout } } });
    const bet = await tx.casinoBet.create({ data: {
      userId: user.id, gameId: "blackjack", gameName: "Blackjack 1V1", amount,
      multiplier: settlement ? settlement.payout / amount : 0, payout: settlement?.payout ?? 0,
      result: settlement?.result ?? "active", clientSeed, serverSeedHash: seed.serverSeedHash, nonce, payload,
    } });
    if (settlement) await tx.houseEarning.create({ data: { gameId: "blackjack", gameName: "Blackjack 1V1", betId: bet.id, wager: amount, payout: settlement.payout, houseProfit: amount - settlement.payout } });
    const finalWallet = await tx.casinoWallet.findUnique({ where: { userId: user.id } });
    return { bet, balance: finalWallet?.balance ?? wallet.balance - amount + (settlement?.payout ?? 0) };
  }).catch((error) => error instanceof Error && error.message === "INSUFFICIENT_BALANCE" ? null : Promise.reject(error));
  if (!created) return err("Insufficient balance", 400);

  return ok({ ...publicState(state, created.bet.id, created.balance), outcome: settlement?.summary ?? null, payout: settlement?.payout ?? 0 });
}
