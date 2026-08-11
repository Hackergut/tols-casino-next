import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";
import { createStarsInvoice } from "@/lib/payment/stars";
import { fireTelegramAlert } from "@/lib/telegram";
import { CHAINS } from "@/lib/chains";

// POST /api/payments/stars — create a Telegram Stars top-up invoice.
// Body: { amountUsdt: number }. Returns the invoice link + the Stars amount.
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return err("Telegram payments not configured", 503);

  const user = await getSession();
  const body = await req.json().catch(() => null);
  const amountUsdt = Number(body?.amountUsdt);
  if (!Number.isFinite(amountUsdt) || amountUsdt < 1) return err("Minimum is 1 USDT", 400);

  // Create the pending row first so its id is the invoice payload.
  const deposit = await db.starsDeposit.create({
    data: {
      userId: user.id,
      usdtAmount: amountUsdt,
      starsAmount: 0,
      payload: "", // filled below
      status: "pending",
    },
  });
  await db.starsDeposit.update({ where: { id: deposit.id }, data: { payload: deposit.id } });

  try {
    const inv = await createStarsInvoice({ botToken, usdtAmount: amountUsdt, payload: deposit.id });
    await db.starsDeposit.update({
      where: { id: deposit.id },
      data: { invoiceLink: inv.invoiceLink, starsAmount: inv.starsAmount },
    });
    fireTelegramAlert({
      event: "stars_invoice",
      title: "Stars invoice created",
      message: `User: ${user.username}\nUSDT: ${amountUsdt}\nStars: ${inv.starsAmount}\nDeposit: ${deposit.id}`,
    });
    return ok({ depositId: deposit.id, invoiceLink: inv.invoiceLink, starsAmount: inv.starsAmount, usdtAmount: amountUsdt });
  } catch (e) {
    await db.starsDeposit.update({ where: { id: deposit.id }, data: { status: "failed" } }).catch(() => {});
    return err((e as Error).message, 500);
  }
}
