import { db } from "@/lib/db";

/*
 * Responsible-gaming enforcement.
 *
 * ResponsibleLimit rows were only ever stored, never checked — a player could
 * set a self-exclusion or a wager cap and still bet/deposit through it. These
 * helpers are the server-side gate: bets call checkBetAllowed(), deposit
 * confirmation calls checkDepositAllowed(). A blocked limit returns a 403 with
 * a clear message; nothing here mutates state.
 *
 * Limits apply per (type, period). When more than one active limit of a type
 * exists, the most recent one wins (the POST /api/limits handler deactivates
 * previous limits of the same type, so in practice there is one).
 *
 * session limits are not enforced here: they require per-session time tracking
 * that the platform does not yet record. TODO: wire a session heartbeat.
 */

// Start of the current accounting window for a period, or null for all-time.
function windowStart(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case "daily": {
      const d = new Date(now);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    case "weekly":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "monthly":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "permanent":
    case "custom":
    default:
      return null; // all-time / until excludeUntil
  }
}

async function activeLimits(userId: string, type: string) {
  return db.responsibleLimit.findMany({
    where: { userId, type, active: true },
    orderBy: { createdAt: "desc" },
  });
}

type Verdict = { allowed: true } | { allowed: false; message: string };
const blocked = (message: string): Verdict => ({ allowed: false, message });

// True if the user has an active self-exclusion that has not expired.
async function isSelfExcluded(userId: string): Promise<string | null> {
  const exclusions = await activeLimits(userId, "self_exclusion");
  for (const e of exclusions) {
    if (!e.excludeUntil || e.excludeUntil > new Date()) {
      return e.excludeUntil
        ? `You are self-excluded until ${e.excludeUntil.toISOString().slice(0, 10)}.`
        : "You are self-excluded from play.";
    }
  }
  return null;
}

export async function checkBetAllowed(userId: string, amount: number): Promise<Verdict> {
  const excluded = await isSelfExcluded(userId);
  if (excluded) return blocked(excluded);

  // Wager cap: total staked in the window must stay under the limit.
  const wagerLimits = await activeLimits(userId, "wager");
  const wl = wagerLimits[0];
  if (wl && wl.limitValue > 0) {
    const start = windowStart(wl.period);
    const agg = await db.casinoBet.aggregate({
      _sum: { amount: true },
      where: { userId, ...(start ? { createdAt: { gte: start } } : {}) },
    });
    const wagered = agg._sum.amount ?? 0;
    if (wagered + amount > wl.limitValue) {
      return blocked(`Wager limit reached for this ${wl.period} period.`);
    }
  }

  // Loss cap: net loss (staked - returned) in the window, counting the new
  // stake as fully at risk (worst case at decision time).
  const lossLimits = await activeLimits(userId, "loss");
  const ll = lossLimits[0];
  if (ll && ll.limitValue > 0) {
    const start = windowStart(ll.period);
    const agg = await db.casinoBet.aggregate({
      _sum: { amount: true, payout: true },
      where: { userId, ...(start ? { createdAt: { gte: start } } : {}) },
    });
    const netLoss = (agg._sum.amount ?? 0) - (agg._sum.payout ?? 0);
    if (netLoss + amount > ll.limitValue) {
      return blocked(`Loss limit reached for this ${ll.period} period.`);
    }
  }

  // Session-time limit: limitValue is the max session length in minutes. The
  // gate is the age of the user's current auth session (AuthSession.createdAt),
  // so a player who has been logged in too long is told to take a break.
  const sessionLimits = await activeLimits(userId, "session");
  const sl = sessionLimits[0];
  if (sl && sl.limitValue > 0) {
    const session = await db.authSession.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (session) {
      const sessionAgeMin = (Date.now() - session.createdAt.getTime()) / 60000;
      if (sessionAgeMin > sl.limitValue) {
        return blocked(`Session limit reached (max ${sl.limitValue} min). Take a break and sign in again.`);
      }
    }
  }

  return { allowed: true };
}

export async function checkDepositAllowed(userId: string, amount: number): Promise<Verdict> {
  const excluded = await isSelfExcluded(userId);
  if (excluded) return blocked("Player is self-excluded.");

  const depositLimits = await activeLimits(userId, "deposit");
  const dl = depositLimits[0];
  if (dl && dl.limitValue > 0) {
    const start = windowStart(dl.period);
    const agg = await db.casinoDeposit.aggregate({
      _sum: { amount: true },
      where: { userId, credited: true, ...(start ? { createdAt: { gte: start } } : {}) },
    });
    const deposited = agg._sum.amount ?? 0;
    if (deposited + amount > dl.limitValue) {
      return blocked(`Deposit limit reached for this ${dl.period} period.`);
    }
  }

  return { allowed: true };
}
