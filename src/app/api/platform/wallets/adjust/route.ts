import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth, hasScope } from "@/lib/platform-auth";
import { platformOptions } from "@/lib/platform-http";
import { publish } from "@/lib/realtime";

/** POST { userId, amount, reason? } — amount may be negative. Real balance, not bonus. */
export async function POST(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "wallets:write")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: wallets:write" }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as { userId?: string; amount?: number; reason?: string } | null;
  if (!body?.userId || typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount === 0) {
    return NextResponse.json({ success: false, error: "userId and a non-zero amount are required" }, { status: 400 });
  }

  const wallet = await db.casinoWallet.findUnique({ where: { userId: body.userId } });
  if (!wallet) return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 404 });
  if (body.amount < 0 && wallet.balance + body.amount < 0) {
    return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 });
  }

  const next = await db.casinoWallet.update({
    where: { userId: body.userId },
    data: { balance: { increment: body.amount } },
    select: { balance: true, bonusBalance: true, currency: true },
  });
  await db.crmActivity.create({
    data: {
      action: "governance.wallet_adjust",
      entityType: "bridge",
      entityId: body.userId,
      details: JSON.stringify({ amount: body.amount, reason: body.reason ?? null }).slice(0, 900),
    },
  }).catch(() => {});
  publish({ event: "balance:update", userId: body.userId, data: { balance: next.balance } });

  return NextResponse.json({ success: true, data: { userId: body.userId, ...next } });
}

export async function OPTIONS() {
  return platformOptions();
}
