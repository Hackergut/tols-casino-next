import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";

// GET /api/payments/stars/status?depositId=... — poll a Stars deposit's status.
// The client calls this after Telegram.WebApp.openInvoice reports 'paid' to
// confirm the webhook credited the wallet (server-side source of truth).
export async function GET(req: NextRequest) {
  const user = await getSession();
  const id = new URL(req.url).searchParams.get("depositId") || "";
  if (!id) return err("depositId required", 400);
  const d = await db.starsDeposit.findUnique({ where: { id } });
  if (!d || d.userId !== user.id) return err("Not found", 404);
  return ok({ status: d.status, usdtAmount: d.usdtAmount, starsAmount: d.starsAmount, paidAt: d.paidAt?.toISOString() ?? null });
}
