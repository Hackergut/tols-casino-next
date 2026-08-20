import { after, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { syncPlayerProfile } from "@/lib/player-sync";
import { syncTournamentProgress } from "@/lib/tournament-progress";
import { err, getSession, ok } from "@/lib/session";
import {
  availableActions, canSplit, draw, handValue, isBlackjack, playDealer, publicState, settle,
  type BlackjackAction, type BlackjackHand, type BlackjackState,
} from "@/lib/blackjack";

export async function POST(req: NextRequest) {
  let user;
  try { user = await getSession(); } catch { return err("Sign in to play", 401); }
  const body = await req.json().catch(() => null) as { action?: BlackjackAction; hand_id?: string } | null;
  if (!body?.hand_id || !body.action) return err("hand_id and action are required", 400);
  const bet = await db.casinoBet.findFirst({ where: { id: body.hand_id, userId: user.id, gameId: "blackjack" } });
  if (!bet) return err("Hand not found", 404);
  const wallet = await db.casinoWallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return err("No wallet", 400);
  const state = JSON.parse(bet.payload) as BlackjackState;
  if (state.phase === "settled" || bet.result !== "active") return ok({ ...publicState(state, bet.id, wallet.balance, true), payout: bet.payout, outcome: bet.result });

  const allowed = availableActions(state, wallet.balance);
  if (!allowed.includes(body.action)) return err("Action is not available", 409);
  let extraDebit = 0;
  let settlement: ReturnType<typeof settle> | null = null;

  // The peek follows the insurance decision. Taking any other action declines
  // insurance and resolves the dealer's ace before the player's move.
  if (state.dealer[1].rank === "A" && !state.insuranceResolved && body.action !== "insurance") {
    state.insuranceResolved = true;
    if (isBlackjack(state.dealer)) settlement = settle(state);
  }

  if (!settlement && body.action === "insurance") {
    extraDebit = Math.round((state.originalBet / 2) * 100) / 100;
    state.insurance = extraDebit;
    state.insuranceResolved = true;
    if (isBlackjack(state.dealer) || isBlackjack(state.hands[0].cards)) settlement = settle(state);
  } else if (!settlement) {
    const hand = state.hands[state.activeHand];
    if (body.action === "hit") {
      hand.cards.push(draw(state));
      const total = handValue(hand.cards).total;
      if (total > 21) hand.status = "bust";
      else if (total === 21) hand.status = "stood";
    } else if (body.action === "stand") {
      hand.status = "stood";
    } else if (body.action === "double") {
      extraDebit = hand.bet;
      hand.bet += extraDebit;
      hand.cards.push(draw(state));
      hand.status = handValue(hand.cards).total > 21 ? "bust" : "stood";
    } else if (body.action === "split" && canSplit(hand)) {
      extraDebit = hand.bet;
      const second = hand.cards.pop()!;
      const firstHand: BlackjackHand = { cards: [hand.cards[0], draw(state)], bet: hand.bet, status: "active" };
      const secondHand: BlackjackHand = { cards: [second, draw(state)], bet: hand.bet, status: "active" };
      if (hand.cards[0].rank === "A") { firstHand.status = "stood"; secondHand.status = "stood"; }
      state.hands = [firstHand, secondHand];
      state.activeHand = 0;
      state.splitUsed = true;
    }

    if (state.hands[state.activeHand]?.status !== "active") {
      const next = state.hands.findIndex((candidate, index) => index > state.activeHand && candidate.status === "active");
      if (next >= 0) state.activeHand = next;
      else {
        if (state.hands.some((candidate) => candidate.status !== "bust")) playDealer(state);
        settlement = settle(state);
      }
    }
  }

  const nextPayload = JSON.stringify(state);
  const totalAmount = bet.amount + extraDebit;
  const saved = await db.$transaction(async (tx) => {
    const claimed = await tx.casinoBet.updateMany({
      where: { id: bet.id, userId: user.id, result: "active", payload: bet.payload },
      data: {
        payload: nextPayload,
        amount: totalAmount,
        ...(settlement ? { result: settlement.result, payout: settlement.payout, multiplier: totalAmount > 0 ? settlement.payout / totalAmount : 0 } : {}),
      },
    });
    if (claimed.count !== 1) throw new Error("STALE_HAND");
    if (extraDebit > 0) {
      const debit = await tx.casinoWallet.updateMany({ where: { userId: user.id, balance: { gte: extraDebit } }, data: { balance: { decrement: extraDebit }, totalWagered: { increment: extraDebit } } });
      if (debit.count !== 1) throw new Error("INSUFFICIENT_BALANCE");
      await tx.globalJackpot.upsert({ where: { id: "global" }, update: { amount: { increment: extraDebit * 0.005 }, contributionsCount: { increment: 1 } }, create: { id: "global", amount: 50000 + extraDebit * 0.005, contributionsCount: 1 } });
    }
    if (settlement?.payout) await tx.casinoWallet.update({ where: { userId: user.id }, data: { balance: { increment: settlement.payout }, totalWon: { increment: settlement.payout } } });
    if (settlement) await tx.houseEarning.create({ data: { gameId: "blackjack", gameName: "Blackjack 1V1", betId: bet.id, wager: totalAmount, payout: settlement.payout, houseProfit: totalAmount - settlement.payout } });
    return tx.casinoWallet.findUnique({ where: { userId: user.id } });
  }).catch((error) => error instanceof Error ? error : new Error("ACTION_FAILED"));

  if (saved instanceof Error) {
    if (saved.message === "INSUFFICIENT_BALANCE") return err("Insufficient balance", 400);
    if (saved.message === "STALE_HAND") return err("Hand changed; refresh state", 409);
    throw saved;
  }
  if (settlement) {
    after(async () => {
      await Promise.all([
        syncPlayerProfile(user.id).catch(() => {}),
        syncTournamentProgress(user.id, "blackjack", totalAmount, {
          won: settlement.result === "win",
          payout: settlement.payout,
        }).catch(() => {}),
      ]);
    });
  }
  return ok({ ...publicState(state, bet.id, saved?.balance ?? wallet.balance, Boolean(settlement)), payout: settlement?.payout ?? 0, outcome: settlement?.summary ?? null });
}
