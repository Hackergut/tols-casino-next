import { after } from "next/server";
import { db } from "@/lib/db";
import { getActiveSeed, nextNonce } from "@/lib/provably-fair";
import { resolveControl, applyForcedMultiplier } from "@/lib/game-control";
import { syncPlayerProfile } from "@/lib/player-sync";
import { getEngine } from "@/lib/game-engines";
import { betResultTag } from "@/lib/game-engines/common";
import { publish } from "@/lib/realtime";
import type { BetResponse, SettledOutcome } from "@/shared/types";

export class BetError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const DEFAULT_WIN: Record<string, number> = {
  dice: 1.98,
  crash: 2,
  limbo: 2,
  coinflip: 1.98,
  wheel: 2,
  mines: 2,
  plinko: 2,
  keno: 3,
  shoot: 2,
  slots: 6,
  roulette: 2,
  blackjack: 2,
};

export interface PlayArgs {
  userId: string;
  game: string;
  amount: number;
  clientSeed?: string;
  payload?: Record<string, unknown>;
  autoBetId?: string;
  roundId?: string;
}

async function applyControl(userId: string, game: string, amount: number, result: SettledOutcome): Promise<{ result: SettledOutcome; controlApplied: string | null }> {
  const decision = await resolveControl(userId, game, { won: result.won, multiplier: result.multiplier });
  if (!decision.override) return { result, controlApplied: null };
  const forcedMult = applyForcedMultiplier(decision, result.multiplier, DEFAULT_WIN[game] ?? 2);
  return {
    controlApplied: decision.mode,
    result: {
      multiplier: forcedMult,
      payout: amount * forcedMult,
      profit: amount * forcedMult - amount,
      won: decision.win,
      payload: { ...result.payload, _control: decision.mode },
    },
  };
}

async function persistSettled(opts: {
  userId: string;
  game: string;
  amount: number;
  result: SettledOutcome;
  seed: string;
  hash: string;
  nonce: number;
  autoBetId?: string;
  roundId?: string;
  alreadyDebited?: boolean;
}): Promise<{ betId: string; balance: number }> {
  const { userId, game, amount, result, seed, hash, nonce, autoBetId, roundId, alreadyDebited } = opts;

  const final = await db.$transaction(async (tx) => {
    if (!alreadyDebited) {
      const debited = await tx.casinoWallet.updateMany({
        where: { userId, balance: { gte: amount } },
        data: {
          balance: { decrement: amount },
          totalWagered: { increment: amount },
          xp: { increment: Math.floor(amount) },
        },
      });
      if (debited.count === 0) return { insufficient: true } as const;
    }

    let balance: number;
    if (result.payout > 0) {
      const w = await tx.casinoWallet.update({
        where: { userId },
        data: {
          balance: { increment: result.payout },
          totalWon: result.won ? { increment: result.payout } : undefined,
        },
        select: { balance: true },
      });
      balance = w.balance;
    } else {
      const w = await tx.casinoWallet.findUnique({ where: { userId }, select: { balance: true } });
      balance = w?.balance ?? 0;
    }

    const bet = await tx.casinoBet.create({
      data: {
        userId,
        gameId: game,
        gameName: game.charAt(0).toUpperCase() + game.slice(1),
        gameCategory: "originals",
        amount,
        multiplier: result.multiplier,
        payout: result.payout,
        result: betResultTag(result),
        clientSeed: seed,
        serverSeedHash: hash,
        nonce,
        payload: JSON.stringify({ ...result.payload, autoBetId: autoBetId ?? null, roundId: roundId ?? null }),
      },
    });

    return { insufficient: false, balance, betId: bet.id } as const;
  });

  if ("insufficient" in final && final.insufficient) throw new BetError("Insufficient balance", 400);

  await db.globalJackpot
    .upsert({
      where: { id: "global" },
      update: { amount: { increment: amount * 0.005 }, contributionsCount: { increment: 1 } },
      create: { id: "global", amount: 50000 + amount * 0.005, contributionsCount: 1 },
    })
    .catch(() => {});

  await db.houseEarning.create({
    data: {
      gameId: game,
      gameName: game.charAt(0).toUpperCase() + game.slice(1),
      betId: final.betId,
      wager: amount,
      payout: result.payout,
      houseProfit: amount - result.payout,
      currency: "USDT",
    },
  });

  after(() => syncPlayerProfile(userId).catch(() => {}));
  publish({ event: "balance:update", userId, data: { balance: final.balance } });
  publish({
    event: "round:result",
    userId,
    data: { gameId: game, result: result.payload, profit: result.profit, multiplier: result.multiplier, won: result.won },
  });

  return { betId: final.betId, balance: final.balance };
}

export async function playInstantBet(args: PlayArgs): Promise<BetResponse> {
  const engine = getEngine(args.game);
  if (!engine) throw new BetError("Unknown game: " + args.game, 400);

  const payload = args.payload ?? {};
  const wallet = await db.casinoWallet.findUnique({ where: { userId: args.userId } });
  if (!wallet) throw new BetError("No wallet", 400);

  const check = engine.validateBet(payload, wallet.balance, args.amount);
  if (!check.valid) throw new BetError(check.error || "Invalid bet", 400);

  const seedPair = await getActiveSeed(args.userId);
  const nonce = await nextNonce(seedPair.id);
  const serverSeed = seedPair.serverSeed;
  const seed = args.clientSeed || seedPair.clientSeed;
  const hash = seedPair.serverSeedHash;

  const outcome = engine.generateOutcome(serverSeed, seed, nonce, payload);
  const raw =
    engine.kind === "interactive" && engine.autoResolve
      ? engine.autoResolve({ amount: args.amount, params: payload }, outcome)
      : engine.settleBet({ amount: args.amount, params: payload }, outcome);

  const { result, controlApplied } = await applyControl(args.userId, args.game, args.amount, raw);
  const saved = await persistSettled({
    userId: args.userId,
    game: args.game,
    amount: args.amount,
    result,
    seed,
    hash,
    nonce,
    autoBetId: args.autoBetId,
  });

  return {
    betId: saved.betId,
    game: args.game,
    amount: args.amount,
    multiplier: result.multiplier,
    payout: result.payout,
    won: result.won,
    payload: result.payload,
    serverSeedHash: hash,
    clientSeed: seed,
    nonce,
    newBalance: saved.balance,
    controlApplied,
  };
}
