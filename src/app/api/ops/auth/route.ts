import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { verifyPassword } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { verifyTotp } from "@/lib/totp";
import {
  createAdminToken, setAdminCookie, clearAdminCookie, getAdminSession, auditLog,
} from "@/lib/admin-auth";

// POST /api/ops/auth — operator sign-in. Credentials are verified server-side
// against the user record (bcrypt) and the account must carry the admin role;
// the browser never sees a password to compare, unlike the previous
// NEXT_PUBLIC_ADMIN_PASSWORD gate which shipped the secret to every visitor.
export async function POST(req: NextRequest) {
  const limited = await rateLimit("ops-auth", LIMITS.auth);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) return err("Email and password are required", 400);

  const user = await db.casinoUser.findUnique({ where: { email } });

  // Same response and roughly the same work for "no such user", "wrong
  // password" and "not an admin", so the endpoint cannot be used to enumerate
  // accounts or discover which ones are privileged.
  const passwordOk = user ? await verifyPassword(password, user.password) : false;
  if (!user || !passwordOk || user.role !== "admin") {
    return err("Invalid credentials", 401);
  }
  if (user.status !== "active") return err("Account is not active", 403);

  // 2FA: if the operator has two-factor enabled, a valid TOTP code is required
  // to complete sign-in. A missing/invalid code returns 401 with twoFactorRequired
  // so the client can prompt for the code and retry without setting the cookie.
  if (user.twoFactorEnabled) {
    const code = String(body.totp ?? "").replace(/\s/g, "");
    if (!verifyTotp(user.twoFactorSecret ?? "", code)) {
      return Response.json({ success: false, error: "Two-factor code required", twoFactorRequired: true }, { status: 401 });
    }
  }

  const token = createAdminToken(user.id, user.username);
  await setAdminCookie(token);
  await auditLog({ userId: user.id, username: user.username, issuedAt: Date.now() }, "admin.login");
  return ok({ username: user.username });
}

// GET /api/ops/auth — is the current caller an operator?
export async function GET() {
  const session = await getAdminSession().catch(() => null);
  return ok({ authenticated: !!session, username: session?.username ?? null });
}

// DELETE /api/ops/auth — sign out.
export async function DELETE() {
  await clearAdminCookie();
  return ok({ signedOut: true });
}
