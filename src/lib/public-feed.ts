/*
 * Public-event builders — the ONE place where a settled bet becomes a
 * broadcast payload.
 *
 * The public SSE stream is a dumb pipe; whatever goes in here reaches every
 * anonymous visitor. So this module is the privacy boundary: it selects
 * exactly `username` and `avatarColor` from the player row — the two fields a
 * player already publishes by appearing in the bet feed — and nothing else.
 * No ids, no emails, no balances. Adding a field here means adding it to the
 * public internet.
 *
 * Called from the settlement paths (settle-bet.ts, game-rounds.ts) AFTER the
 * money transaction has committed, always fire-and-forget: a slow lookup or a
 * dropped broadcast must never delay or fail a bet that has already settled.
 */

import { db } from "@/lib/db";
import { publishPublic, type FeedBetWire } from "@/lib/realtime";

/**
 * A win only graduates from feed row to "winner" announcement when it is
 * worth announcing. Payout is the number spectators react to; the multiplier
 * floor keeps a whale's routine 1.5x from drowning out a genuine hit.
 */
const WINNER_MIN_PAYOUT = 500;
const WINNER_MIN_MULTIPLIER = 5;

export interface SettledBetBroadcast {
  betId: string;
  userId: string;
  gameId: string;
  gameName: string;
  amount: number;
  multiplier: number;
  payout: number;
  result: string;
  currency?: string;
  createdAt?: Date;
}

/**
 * Broadcast a settled bet to the public feed (and, when big enough, as a
 * winner announcement). Never throws — the bet is already settled and paid;
 * telemetry about it is best-effort by definition.
 */
export async function broadcastSettledBet(opts: SettledBetBroadcast): Promise<void> {
  try {
    const user = await db.casinoUser.findUnique({
      where: { id: opts.userId },
      select: { username: true, avatarColor: true },
    });

    const wire: FeedBetWire = {
      id: opts.betId,
      gameId: opts.gameId,
      gameName: opts.gameName,
      username: user?.username ?? "anonymous",
      avatarColor: user?.avatarColor ?? "#cdf32b",
      amount: opts.amount,
      multiplier: opts.multiplier,
      payout: opts.payout,
      result: opts.result,
      currency: opts.currency ?? "USDT",
      createdAt: (opts.createdAt ?? new Date()).toISOString(),
    };

    publishPublic({ event: "feed:bet", data: wire });

    if (opts.result === "win" && opts.payout >= WINNER_MIN_PAYOUT && opts.multiplier >= WINNER_MIN_MULTIPLIER) {
      publishPublic({
        event: "winner:new",
        data: {
          id: wire.id,
          username: wire.username,
          avatarColor: wire.avatarColor,
          gameName: wire.gameName,
          amount: wire.amount,
          multiplier: wire.multiplier,
          payout: wire.payout,
          createdAt: wire.createdAt,
        },
      });
    }
  } catch {
    /* best-effort broadcast — never surfaces to the player */
  }
}

/** Broadcast the jackpot ticker after a contribution. Best-effort. */
export function broadcastJackpot(amount: number, contributionsCount?: number): void {
  try {
    publishPublic({ event: "jackpot:update", data: { amount, contributionsCount } });
  } catch {
    /* ignore */
  }
}
