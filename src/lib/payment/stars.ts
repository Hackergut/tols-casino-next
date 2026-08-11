import { db } from "@/lib/db";

/*
 * Telegram Stars (XTR) — the in-app wallet available to every Telegram user.
 *
 * A player tops up their casino balance by paying Stars through a Telegram
 * invoice (createInvoiceLink, currency XTR). Telegram charges the user's Stars
 * and POSTs successful_payment to our webhook; we credit the wallet there. The
 * conversion rate is configurable via STARS_TO_USDT (USDT per 1 Star).
 *
 * Note: Stars cannot be withdrawn to crypto by the bot — they are an in-app
 * currency. This is a deposit-in (buy chips) rail, not a payout rail.
 */

// USDT credited per 1 Telegram Star. ~$0.013 per Star; default 0.012.
export const starsToUsdtRate = (): number => {
  const r = Number(process.env.STARS_TO_USDT ?? 0.012);
  return Number.isFinite(r) && r > 0 ? r : 0.012;
};

// Stars are an integer; round UP so the player always pays enough for the USDT.
export function usdtToStars(usdt: number): number {
  return Math.max(1, Math.ceil(usdt / starsToUsdtRate()));
}

export interface CreatedInvoice {
  invoiceLink: string;
  starsAmount: number;
  payload: string;
}

export async function createStarsInvoice(args: {
  botToken: string;
  usdtAmount: number;
  payload: string;
}): Promise<CreatedInvoice> {
  const stars = usdtToStars(args.usdtAmount);
  const res = await fetch(`https://api.telegram.org/bot${args.botToken}/createInvoiceLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `TOLS Casino — ${args.usdtAmount} USDT`,
      description: `Top up ${args.usdtAmount} USDT to your casino balance`,
      payload: args.payload,
      currency: "XTR",
      prices: [{ label: "Balance top-up", amount: stars }],
    }),
  });
  const j = (await res.json()) as { ok: boolean; result?: string; description?: string };
  if (!j.ok || !j.result) throw new Error(`createInvoiceLink failed: ${j.description ?? JSON.stringify(j)}`);
  return { invoiceLink: j.result, starsAmount: stars, payload: args.payload };
}

// Credit a Stars deposit identified by its payload (= row id). Idempotent: only
// a pending row is flipped to paid and the wallet incremented, in one
// transaction, so a replayed webhook or a double-delivery never double-credits.
export async function creditStarsDeposit(payload: string): Promise<{ credited: boolean; userId?: string; usdt?: number }> {
  const deposit = await db.starsDeposit.findUnique({ where: { payload } });
  if (!deposit) return { credited: false };
  const result = await db.$transaction(async (tx) => {
    const upd = await tx.starsDeposit.updateMany({
      where: { id: deposit.id, status: "pending" },
      data: { status: "paid", paidAt: new Date() },
    });
    if (upd.count === 0) return false;
    await tx.casinoWallet.update({
      where: { userId: deposit.userId },
      data: { balance: { increment: deposit.usdtAmount } },
    });
    return true;
  });
  return { credited: result, userId: deposit.userId, usdt: deposit.usdtAmount };
}
