import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ok, err } from "@/lib/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

// POST /api/auth/reset-password { token, password } — sets a new password if the
// token is valid and not expired, then clears it.
export async function POST(req: NextRequest) {
  const limited = await rateLimit("reset", LIMITS.auth);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");
  if (!token || password.length < 8) return err("Token and an 8+ char password are required", 400);
  const user = await db.casinoUser.findUnique({ where: { resetToken: token } });
  if (!user || !user.resetExpires || user.resetExpires < new Date()) return err("Invalid or expired token", 400);
  await db.casinoUser.update({
    where: { id: user.id },
    data: { password: await hashPassword(password), resetToken: null, resetExpires: null },
  });
  return ok({ reset: true });
}
