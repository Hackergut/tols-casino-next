import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth, hasScope } from "@/lib/platform-auth";

/**
 * POST /api/platform/withdrawals/:id/reject — JWT RS256, scope withdrawals:write
 * Body: { reason?: string }
 * Rejects a pending withdrawal and refunds the wallet (atomic).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "withdrawals:write")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: withdrawals:write" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({})) as { reason?: string };
  const w = await db.casinoWithdrawal.findUnique({ where: { id } });
  if (!w) return NextResponse.json({ success: false, error: "Withdrawal not found" }, { status: 404 });
  if (w.status !== "pending") return NextResponse.json({ success: false, error: `Already ${w.status}` }, { status: 409 });

  // Refund
  const wallet = await db.casinoWallet.findUnique({ where: { userId: w.userId } });
  if (wallet) {
    await db.casinoWallet.update({ where: { userId: w.userId }, data: { balance: wallet.balance + w.amount } });
  }

  const updated = await db.casinoWithdrawal.update({
    where: { id },
    data: { status: "rejected", processedDate: new Date() },
  });

  await db.crmActivity.create({
    data: { action: "platform_withdrawal_reject", entityType: "platform", entityId: id, details: JSON.stringify({ by: auth.claims.sub || "platform", reason: body.reason }).slice(0, 900) },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: { id: updated.id, status: updated.status, refunded: Boolean(wallet) } });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
}
