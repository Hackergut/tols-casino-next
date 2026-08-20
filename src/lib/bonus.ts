/*
 * Bonus money / wagering engine.
 *
 * Governance (or an operator) credits bonus money to a player. That money is
 * real value, but for the casino it is NOT withdrawable until the player has
 * wagered `amount * multiplier` in total (the "playthrough" / wagering
 * requirement). While locked it is still playable: bets are funded from real
 * balance first, then bonus balance, and every stake counts toward the
 * requirement. The moment the requirement is satisfied, all remaining bonus
 * releases into the withdrawable balance.
 *
 * Winnings are non-sticky: they credit the real balance directly. Only the
 * bonus principal is locked behind wagering.
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/realtime";

export const DEFAULT_WAGERING_MULTIPLIER = 20;

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface BetDebitResult {
  insufficient: boolean;
  /** Real balance after the debit (and any release). */
  balance: number;
  /** Bonus balance after the debit (and any release). */
  bonusBalance: number;
  /** Wagering still required before the next release. */
  wageringRemaining: number;
  /** Portion of the stake funded from bonus balance. */
  fromBonus: number;
  /** Bonus amount released into the real balance this debit (0 if none). */
  released: number;
}

/**
 * Debit a stake inside the caller's transaction. Funds come from real balance
 * first, then bonus balance. The full stake counts toward wagering; when the
 * requirement completes, every active credit releases into the real balance.
 */
export async function applyBetDebit(
  // The Prisma transaction client is deliberately untyped here: the generated
  // client is not available in every build sandbox, and typing it would pull
  // the `@prisma/client` namespace into a hot path that must stay importable.
  tx: any,
  userId: string,
  amount: number,
): Promise<BetDebitResult> {
  const wallet = await tx.casinoWallet.findUnique({ where: { userId } });
  if (!wallet) {
    return { insufficient: true, balance: 0, bonusBalance: 0, wageringRemaining: 0, fromBonus: 0, released: 0 };
  }

  const stake = roundCents(amount);
  const available = roundCents(wallet.balance + wallet.bonusBalance);
  if (available + 1e-9 < stake) {
    return { insufficient: true, balance: wallet.balance, bonusBalance: wallet.bonusBalance, wageringRemaining: wallet.wageringRemaining, fromBonus: 0, released: 0 };
  }

  const fromReal = Math.min(wallet.balance, stake);
  const fromBonus = roundCents(stake - fromReal);

  // Atomic, guarded debit: only succeeds if the exact funds we just read are
  // still present, so two concurrent bets can never overdraw the wallet.
  const debited = await tx.casinoWallet.updateMany({
    where: { userId, balance: { gte: fromReal }, bonusBalance: { gte: fromBonus } },
    data: {
      balance: { decrement: fromReal },
      bonusBalance: { decrement: fromBonus },
      totalWagered: { increment: stake },
      xp: { increment: Math.floor(stake) },
    },
  });
  if (debited.count === 0) {
    return { insufficient: true, balance: wallet.balance, bonusBalance: wallet.bonusBalance, wageringRemaining: wallet.wageringRemaining, fromBonus: 0, released: 0 };
  }

  // Wagering progress. Not security-critical: a benign race here can only shift
  // the release timing by a fraction of a stake, never lose funds.
  await tx.casinoWallet.updateMany({
    where: { userId, wageringRemaining: { gt: 0 } },
    data: { wageringRemaining: { decrement: stake } },
  });

  let after = await tx.casinoWallet.findUnique({
    where: { userId },
    select: { balance: true, bonusBalance: true, wageringRemaining: true },
  });

  let released = 0;
  if (after && after.wageringRemaining <= 0 && after.bonusBalance > 0) {
    // Wagering complete — release every remaining bonus to real balance.
    released = after.bonusBalance;
    await tx.casinoWallet.update({
      where: { userId },
      data: { balance: { increment: after.bonusBalance }, bonusBalance: 0, wageringRemaining: 0 },
    });
    await tx.bonusCredit.updateMany({
      where: { userId, status: "active" },
      data: { status: "released", releasedAt: new Date() },
    });
    after = await tx.casinoWallet.findUnique({
      where: { userId },
      select: { balance: true, bonusBalance: true, wageringRemaining: true },
    });
  }

  return {
    insufficient: false,
    balance: after?.balance ?? 0,
    bonusBalance: after?.bonusBalance ?? 0,
    wageringRemaining: Math.max(0, after?.wageringRemaining ?? 0),
    fromBonus,
    released,
  };
}

/** Standalone debit for the interactive bet path (opens its own transaction). */
export async function debitBet(userId: string, amount: number): Promise<BetDebitResult> {
  return db.$transaction((tx) => applyBetDebit(tx, userId, amount));
}

export interface CreditBonusArgs {
  userId: string;
  amount: number;
  multiplier?: number;
  source?: string;
  reason?: string;
  expiresAt?: Date | string | null;
}

export interface CreditBonusResult {
  id: string;
  amount: number;
  multiplier: number;
  bonusBalance: number;
  wageringRemaining: number;
}

/**
 * Credit bonus money to a player (Governance / operator). Bumps the locked
 * bonus balance and the wagering requirement by `amount * multiplier`, and
 * records an audit ledger row.
 */
export async function creditBonus(args: CreditBonusArgs): Promise<CreditBonusResult> {
  const amount = roundCents(args.amount);
  if (!(amount > 0)) throw new Error("Bonus amount must be positive");
  const multiplier = args.multiplier && args.multiplier > 0 ? args.multiplier : DEFAULT_WAGERING_MULTIPLIER;
  const requirement = roundCents(amount * multiplier);

  const result = await db.$transaction(async (tx) => {
    const wallet = await tx.casinoWallet.findUnique({ where: { userId: args.userId } });
    if (!wallet) throw new Error("Wallet not found");

    const credit = await tx.bonusCredit.create({
      data: {
        userId: args.userId,
        amount,
        multiplier,
        source: args.source ?? "governance",
        reason: args.reason ?? "",
        expiresAt: args.expiresAt ? new Date(args.expiresAt) : null,
      },
    });

    const updated = await tx.casinoWallet.update({
      where: { userId: args.userId },
      data: {
        bonusBalance: { increment: amount },
        wageringRemaining: { increment: requirement },
      },
      select: { bonusBalance: true, wageringRemaining: true },
    });

    return { id: credit.id, bonusBalance: updated.bonusBalance, wageringRemaining: updated.wageringRemaining };
  });

  publish({
    event: "bonus:update",
    userId: args.userId,
    data: { bonusBalance: result.bonusBalance, wageringRemaining: result.wageringRemaining },
  });

  return {
    id: result.id,
    amount,
    multiplier,
    bonusBalance: result.bonusBalance,
    wageringRemaining: result.wageringRemaining,
  };
}
