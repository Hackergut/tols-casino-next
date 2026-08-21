import { db } from "@/lib/db";
import { getActiveSeed, nextNonce } from "@/lib/provably-fair";
import { getEngine } from "@/lib/game-engines";
import { BetError } from "@/lib/settle-bet";
import { betResultTag } from "@/lib/game-engines/common";
import { publish } from "@/lib/realtime";
import { broadcastSettledBet, broadcastJackpot } from "@/lib/public-feed";
import { debitBet } from "@/lib/bonus";
import { pushBridgeEvent, pushSettledBet } from "@/lib/governance-bridge";
import { after } from "next/server";
import { syncPlayerProfile } from "@/lib/player-sync";
import type { BetResponse, InteractiveRoundState } from "@/shared/types";

const ROUND_TTL_MS = 10 * 60 * 1000;

interface RoundPayload {
  secret: Record<string, unknown>;
  publicState: Record<string, unknown>;
  startedAt: number;
  autoBetId?: string;
}

function asPayload(raw: string): RoundPayload {
  try {
    return JSON.parse(raw) as RoundPayload;
  } catch {
    return { secret: {}, publicState: {}, startedAt: Date.now() };
  }
}

async function debit(userId: string, amount: number): Promise<number> {
  const d = await debitBet(userId, amount);
  if (d.insufficient) throw new BetError("Insufficient balance", 400);
  if (d.released > 0) {
    after(() => pushBridgeEvent("casino.bonus_released", { userId, amount: d.released, balance: d.balance }).catch(() => {}));
  }
  return d.balance;
}

async function walletBonus(userId: string): Promise<{ bonusBalance: number; wageringRemaining: number }> {
  const w = await db.casinoWallet.findUnique({ where: { userId }, select: { bonusBalance: true, wageringRemaining: true } });
  return { bonusBalance: w?.bonusBalance ?? 0, wageringRemaining: w?.wageringRemaining ?? 0 };
}

async function creditPayout(userId: string, payout: number, won: boolean): Promise<number> {
  if (payout > 0) {
    const w = await db.casinoWallet.update({
      where: { userId },
      data: {
        balance: { increment: payout },
        totalWon: won ? { increment: payout } : undefined,
      },
      select: { balance: true },
    });
    return w.balance;
  }
  const w = await db.casinoWallet.findUnique({ where: { userId }, select: { balance: true } });
  return w?.balance ?? 0;
}

async function finalizeHouse(opts: { game: string; betId: string; amount: number; payout: number; userId: string; result?: string; multiplier?: number }) {
  await db.houseEarning.create({
    data: {
      gameId: opts.game,
      gameName: opts.game.charAt(0).toUpperCase() + opts.game.slice(1),
      betId: opts.betId,
      wager: opts.amount,
      payout: opts.payout,
      houseProfit: opts.amount - opts.payout,
      currency: "USDT",
    },
  });
  await db.globalJackpot
    .upsert({
      where: { id: "global" },
      update: { amount: { increment: opts.amount * 0.005 }, contributionsCount: { increment: 1 } },
      create: { id: "global", amount: 50000 + opts.amount * 0.005, contributionsCount: 1 },
      select: { amount: true, contributionsCount: true },
    })
    .then((jp) => broadcastJackpot(jp.amount, jp.contributionsCount))
    .catch(() => {});
  after(() => syncPlayerProfile(opts.userId).catch(() => {}));
  // Every closed round reaches the public feed from here — the settle,
  // player-action and expiry paths all converge on finalizeHouse.
  after(() =>
    broadcastSettledBet({
      betId: opts.betId,
      userId: opts.userId,
      gameId: opts.game,
      gameName: opts.game.charAt(0).toUpperCase() + opts.game.slice(1),
      amount: opts.amount,
      multiplier: opts.multiplier ?? (opts.amount > 0 ? opts.payout / opts.amount : 0),
      payout: opts.payout,
      result: opts.result ?? (opts.payout > opts.amount ? "win" : opts.payout === opts.amount && opts.payout > 0 ? "push" : "lose"),
    }),
  );
  after(() =>
    pushSettledBet({
      userId: opts.userId,
      game: opts.game,
      amount: opts.amount,
      payout: opts.payout,
      multiplier: opts.multiplier ?? (opts.amount > 0 ? opts.payout / opts.amount : 0),
      won: opts.payout > opts.amount,
      betId: opts.betId,
    }),
  );
}

export async function expireStaleRounds(userId: string, gameId?: string): Promise<void> {
  const cutoff = new Date(Date.now() - ROUND_TTL_MS);
  const pending = await db.casinoBet.findMany({
    where: {
      userId,
      result: "pending",
      ...(gameId ? { gameId } : { createdAt: { lt: cutoff } }),
    },
  });

  for (const r of pending) {
    await db.casinoBet.update({
      where: { id: r.id },
      data: {
        result: "lose",
        payout: 0,
        multiplier: 0,
        payload: JSON.stringify({ expired: true, ...asPayload(r.payload).publicState }),
      },
    });
    await finalizeHouse({ game: r.gameId, betId: r.id, amount: r.amount, payout: 0, userId, result: "lose", multiplier: 0 });
  }
}

export async function startRound(opts: {
  userId: string;
  game: string;
  amount: number;
  clientSeed?: string;
  payload?: Record<string, unknown>;
  autoBetId?: string;
}): Promise<BetResponse> {
  const engine = getEngine(opts.game);
  if (!engine || engine.kind !== "interactive") throw new BetError("Game is not interactive", 400);

  const wallet = await db.casinoWallet.findUnique({ where: { userId: opts.userId } });
  if (!wallet) throw new BetError("No wallet", 400);
  const check = engine.validateBet(opts.payload ?? {}, wallet.balance + wallet.bonusBalance, opts.amount);
  if (!check.valid) throw new BetError(check.error || "Invalid bet", 400);

  await expireStaleRounds(opts.userId, opts.game);

  const seedPair = await getActiveSeed(opts.userId);
  const nonce = await nextNonce(seedPair.id);
  const seed = opts.clientSeed || seedPair.clientSeed;
  const outcome = engine.generateOutcome(seedPair.serverSeed, seed, nonce, opts.payload ?? {});

  const startedAt = Date.now();
  let state: InteractiveRoundState = {
    status: "pending",
    amount: opts.amount,
    secret: { ...outcome, startedAt },
    publicState: {},
    multiplier: 0,
    payout: 0,
    won: false,
  };

  if (engine.handlePlayerAction) {
    state = engine.handlePlayerAction({ type: "deal-check" }, state);
  }

  const balanceAfterDebit = await debit(opts.userId, opts.amount);

  const stored: RoundPayload = {
    secret: state.secret,
    publicState: state.publicState,
    startedAt,
    autoBetId: opts.autoBetId,
  };

  const row = await db.casinoBet.create({
    data: {
      userId: opts.userId,
      gameId: opts.game,
      gameName: opts.game.charAt(0).toUpperCase() + opts.game.slice(1),
      gameCategory: "originals",
      amount: opts.amount,
      multiplier: state.multiplier,
      payout: state.payout,
      result: state.status === "settled" ? betResultTag(state) : "pending",
      clientSeed: seed,
      serverSeedHash: seedPair.serverSeedHash,
      nonce,
      payload: JSON.stringify(stored),
    },
  });

  let newBalance = balanceAfterDebit;
  if (state.status === "settled") {
    newBalance = await creditPayout(opts.userId, state.payout, state.won);
    await db.casinoBet.update({
      where: { id: row.id },
      data: {
        result: betResultTag(state),
        multiplier: state.multiplier,
        payout: state.payout,
        payload: JSON.stringify(state.publicState),
      },
    });
    await finalizeHouse({ game: opts.game, betId: row.id, amount: opts.amount, payout: state.payout, userId: opts.userId, result: betResultTag(state), multiplier: state.multiplier });
  }

  publish({ event: "round:started", userId: opts.userId, data: { gameId: opts.game, roundId: row.id } });
  publish({ event: "balance:update", userId: opts.userId, data: { balance: newBalance } });
  const bonus = await walletBonus(opts.userId);
  publish({ event: "bonus:update", userId: opts.userId, data: bonus });

  return {
    betId: row.id,
    roundId: row.id,
    game: opts.game,
    amount: opts.amount,
    multiplier: state.multiplier,
    payout: state.payout,
    won: state.won,
    payload: state.publicState,
    serverSeedHash: seedPair.serverSeedHash,
    clientSeed: seed,
    nonce,
    newBalance,
    bonusBalance: bonus.bonusBalance,
    wageringRemaining: bonus.wageringRemaining,
    availableBalance: newBalance + bonus.bonusBalance,
    controlApplied: null,
    pending: state.status === "pending",
  };
}

export async function applyAction(opts: {
  userId: string;
  game: string;
  roundId: string;
  action: { type: string } & Record<string, unknown>;
}): Promise<BetResponse> {
  const engine = getEngine(opts.game);
  if (!engine?.handlePlayerAction) throw new BetError("Game does not accept actions", 400);

  const row = await db.casinoBet.findFirst({
    where: { id: opts.roundId, userId: opts.userId, gameId: opts.game },
  });
  if (!row) throw new BetError("Round not found", 404);
  if (row.result !== "pending") throw new BetError("Round already settled", 400);

  const stored = asPayload(row.payload);
  let state: InteractiveRoundState = {
    status: "pending",
    amount: row.amount,
    secret: stored.secret,
    publicState: stored.publicState,
    multiplier: row.multiplier,
    payout: row.payout,
    won: false,
  };

  state = engine.handlePlayerAction(opts.action, state);

  if (state.extraDebit && state.extraDebit > 0) {
    await debit(opts.userId, state.extraDebit);
    state.amount += state.extraDebit;
  }

  let newBalance =
    (await db.casinoWallet.findUnique({ where: { userId: opts.userId }, select: { balance: true } }))?.balance ?? 0;

  if (state.status === "settled") {
    newBalance = await creditPayout(opts.userId, state.payout, state.won);
    await db.casinoBet.update({
      where: { id: row.id },
      data: {
        amount: state.amount,
        result: betResultTag(state),
        multiplier: state.multiplier,
        payout: state.payout,
        payload: JSON.stringify(state.publicState),
      },
    });
    await finalizeHouse({
      game: opts.game,
      betId: row.id,
      amount: state.amount,
      payout: state.payout,
      userId: opts.userId,
      result: betResultTag(state),
      multiplier: state.multiplier,
    });
    publish({
      event: "round:result",
      userId: opts.userId,
      data: { gameId: opts.game, roundId: row.id, ...state.publicState, multiplier: state.multiplier, won: state.won },
    });
  } else {
    await db.casinoBet.update({
      where: { id: row.id },
      data: {
        amount: state.amount,
        multiplier: state.multiplier,
        payload: JSON.stringify({
          secret: state.secret,
          publicState: state.publicState,
          startedAt: stored.startedAt,
          autoBetId: stored.autoBetId,
        }),
      },
    });
  }

  publish({ event: "balance:update", userId: opts.userId, data: { balance: newBalance } });
  const bonus = await walletBonus(opts.userId);
  publish({ event: "bonus:update", userId: opts.userId, data: bonus });

  return {
    betId: row.id,
    roundId: row.id,
    game: opts.game,
    amount: state.amount,
    multiplier: state.multiplier,
    payout: state.payout,
    won: state.won,
    payload: state.publicState,
    serverSeedHash: row.serverSeedHash,
    clientSeed: row.clientSeed,
    nonce: row.nonce,
    newBalance,
    bonusBalance: bonus.bonusBalance,
    wageringRemaining: bonus.wageringRemaining,
    availableBalance: newBalance + bonus.bonusBalance,
    controlApplied: null,
    pending: state.status === "pending",
  };
}
