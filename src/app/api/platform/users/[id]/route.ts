import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth, hasScope } from "@/lib/platform-auth";
import { platformOptions } from "@/lib/platform-http";
import { publish } from "@/lib/realtime";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "users:read")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: users:read" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const user = await db.casinoUser.findUnique({
    where: { id },
    include: {
      wallet: true,
      _count: { select: { bets: true, deposits: true, withdrawals: true } },
    },
  });
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  const { password: _p, twoFactorSecret: _t, resetToken: _r, emailVerifyToken: _e, ...safe } = user;
  void _p; void _t; void _r; void _e;
  return NextResponse.json({ success: true, data: safe });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "users:write")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: users:write" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as { action?: string; status?: string; blocked?: boolean } | null;
  if (!body) return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });

  const blocked = body.action === "block" || body.blocked === true || body.status === "blocked";
  const unblock = body.action === "unblock" || body.blocked === false || body.status === "active";
  const status = blocked ? "blocked" : unblock ? "active" : body.status;
  if (!status) return NextResponse.json({ success: false, error: "action block|unblock or status required" }, { status: 400 });

  const user = await db.casinoUser.update({
    where: { id },
    data: { status },
    select: { id: true, username: true, status: true },
  }).catch(() => null);
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  if (status === "blocked") {
    await db.authSession.deleteMany({ where: { userId: id } }).catch(() => {});
  }
  publish({ event: "error", userId: id, data: { code: status === "blocked" ? "blocked" : "unblocked" } });
  await db.crmActivity.create({
    data: { action: "governance.user_status", entityType: "bridge", entityId: id, details: JSON.stringify({ status }).slice(0, 900) },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: user });
}

export async function OPTIONS() {
  return platformOptions();
}
