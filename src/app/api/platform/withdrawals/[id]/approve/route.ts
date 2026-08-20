import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth, hasScope } from "@/lib/platform-auth";

/**
 * POST /api/platform/withdrawals/:id/approve — JWT RS256, scope withdrawals:write
 * Body: { txHash?: string }
 * Approves a pending withdrawal (same logic as /api/ops/withdrawals but for Governance).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "withdrawals:write")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: withdrawals:write" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({})) as { txHash?: string };
  const w = await db.casinoWithdrawal.findUnique({ where: { id }, include: { user: { select: { username: true } } } });
  if (!w) return NextResponse.json({ success: false, error: "Withdrawal not found" }, { status: 404 });
  if (w.status !== "pending") return NextResponse.json({ success: false, error: `Already ${w.status}` }, { status: 409 });

  const updated = await db.casinoWithdrawal.update({
    where: { id },
    data: { status: "approved", txHash: body.txHash || w.txHash, processedDate: new Date() },
  });

  await db.crmActivity.create({
    data: { action: "platform_withdrawal_approve", entityType: "platform", entityId: id, details: JSON.stringify({ by: auth.claims.sub || "platform", txHash: body.txHash }).slice(0, 900) },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: { id: updated.id, status: updated.status, txHash: updated.txHash } });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
}
