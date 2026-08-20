import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { supportUser } from "@/lib/support";

// GET /api/bonus — the player's bonus money state: locked bonus balance,
// remaining wagering requirement, and the audit ledger of bonus credits.
export async function GET() {
  const user = await supportUser();
  if (!user) return err("Not authenticated", 401);

  const wallet = await db.casinoWallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return err("Wallet not found", 404);

  const credits = await db.bonusCredit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return ok({
    bonusBalance: wallet.bonusBalance,
    wageringRemaining: wallet.wageringRemaining,
    availableBalance: wallet.balance + wallet.bonusBalance,
    balance: wallet.balance,
    credits: credits.map((c) => ({
      id: c.id,
      amount: c.amount,
      multiplier: c.multiplier,
      status: c.status,
      source: c.source,
      reason: c.reason,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      releasedAt: c.releasedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}
