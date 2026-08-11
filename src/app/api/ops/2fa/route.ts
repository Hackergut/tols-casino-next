import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { requireAdmin, auditLog } from "@/lib/admin-auth";
import { generateSecret, verifyTotp, provisioningUri } from "@/lib/totp";

const ISSUER = "TOLS Control";

// GET /api/ops/2fa — current 2FA state for the signed-in operator
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const user = await db.casinoUser.findUnique({
    where: { id: guard.session.userId },
    select: { twoFactorEnabled: true, twoFactorSecret: true },
  });
  return ok({ enabled: !!user?.twoFactorEnabled, hasSecret: !!user?.twoFactorSecret });
}

// POST /api/ops/2fa — start enrollment: generate a secret (NOT yet enabled).
// Returns the raw secret + an otpauth:// URI for the authenticator. The
// operator then confirms a live code with PUT to actually enable 2FA.
export async function POST() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const secret = generateSecret();
  const user = await db.casinoUser.update({
    where: { id: guard.session.userId },
    data: { twoFactorSecret: secret },
    select: { username: true },
  });
  return ok({ secret, otpauthUri: provisioningUri(ISSUER, user.username, secret) });
}

// PUT /api/ops/2fa — enable 2FA after verifying a code from the authenticator
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").replace(/\s/g, "");
  const user = await db.casinoUser.findUnique({
    where: { id: guard.session.userId },
    select: { twoFactorSecret: true },
  });
  if (!user?.twoFactorSecret) return err("Start enrollment first (POST)", 400);
  if (!verifyTotp(user.twoFactorSecret, code)) return err("Invalid code", 401);
  await db.casinoUser.update({ where: { id: guard.session.userId }, data: { twoFactorEnabled: true } });
  await auditLog(guard.session, "admin.2fa.enable", {});
  return ok({ enabled: true });
}

// DELETE /api/ops/2fa — disable 2FA (requires a valid current code)
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").replace(/\s/g, "");
  const user = await db.casinoUser.findUnique({
    where: { id: guard.session.userId },
    select: { twoFactorSecret: true },
  });
  if (!user?.twoFactorSecret || !verifyTotp(user.twoFactorSecret, code)) return err("Invalid code", 401);
  await db.casinoUser.update({
    where: { id: guard.session.userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  await auditLog(guard.session, "admin.2fa.disable", {});
  return ok({ enabled: false });
}
