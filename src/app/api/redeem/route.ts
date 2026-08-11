import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { fireTelegramAlert } from "@/lib/telegram";

// POST /api/redeem { code } — redeem a bonus/promo code. Credits the wallet
// atomically (conditional on uses < maxUses) so a code can't be over-redeemed.
export async function POST(req: NextRequest) {
  const limited = await rateLimit("redeem", LIMITS.general);
  if (limited) return limited;

  const user = await getSession();
  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  if (!code) return err("Enter a code", 400);

  const rc = await db.redeemCode.findUnique({ where: { code } });
  if (!rc || !rc.active) return err("Invalid code", 400);

  // Atomic: only increment if uses < maxUses (prevents over-redemption).
  const result = await db.$transaction(async (tx) => {
    const updated = await tx.redeemCode.updateMany({
      where: { id: rc.id, uses: { lt: rc.maxUses }, active: true },
      data: { uses: { increment: 1 } },
    });
    if (updated.count === 0) return false;
    await tx.casinoWallet.update({
      where: { userId: user.id },
      data: { balance: { increment: rc.amount } },
    });
    return true;
  });

  if (!result) return err("Code already used or expired", 400);

  fireTelegramAlert({
    event: "registration",
    title: "Code redeemed",
    message: `User: ${user.username}\nCode: ${code}\nAmount: ${rc.amount} ${rc.currency}`,
  });

  return ok({ redeemed: true, amount: rc.amount, currency: rc.currency });
}
