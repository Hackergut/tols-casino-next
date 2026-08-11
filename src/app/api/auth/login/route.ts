import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { fireTelegramAlert } from "@/lib/telegram";
import { ok, err } from "@/lib/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limited = await rateLimit("auth", LIMITS.auth);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid request", 400);

  const identifier = String(body.identifier ?? body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!identifier || !password) return err("Enter your email/username and password", 400);

  const user = await db.casinoUser.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    include: { wallet: true },
  });

  // Uniform error to avoid leaking which accounts exist.
  if (!user) return err("Invalid credentials", 401);
  if (user.status === "banned" || user.status === "suspended") return err("This account is not active", 403);

  const valid = await verifyPassword(password, user.password);
  if (!valid) return err("Invalid credentials", 401);

  await createSession(user.id);

  fireTelegramAlert({
    event: "login",
    title: "🔓 Login",
    message: `User: ${user.username}\nEmail: ${user.email}\nTime: ${new Date().toISOString()}`,
  });

  return ok({
    id: user.id,
    username: user.username,
    email: user.email,
    avatarColor: user.avatarColor,
    level: user.level,
    balance: user.wallet?.balance ?? 0,
    currency: user.wallet?.currency ?? "USDT",
    vipLevel: user.wallet?.vipLevel ?? 1,
  });
}
