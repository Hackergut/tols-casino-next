import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { randomBytes } from "crypto";

const COOKIE = "tols_session";
const SESSION_DAYS = 30;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash).catch(() => false);
}

function newToken(): string {
  return randomBytes(32).toString("hex");
}

// ── Create a session row + set the signed HTTP-only cookie ──
export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const h = await headers();
  await db.authSession.create({
    data: {
      userId,
      token,
      userAgent: h.get("user-agent")?.slice(0, 250) ?? "",
      ip: (h.get("x-forwarded-for") ?? "").split(",")[0].slice(0, 45),
      expiresAt,
    },
  });

  const store = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    // SameSite=None so the session cookie is sent inside Telegram's cross-site
    // iframe (the Web/Desktop Mini App runs framed by web.telegram.org). None
    // requires Secure, so it is production-only; local dev over http stays Lax.
    sameSite: isProd ? "none" : "lax",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

// ── Resolve the current authenticated user, or null ──
export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const session = await db.authSession.findUnique({ where: { token } });
  if (!session || session.expiresAt < new Date()) return null;

  const user = await db.casinoUser.findUnique({
    where: { id: session.userId },
    include: { wallet: true },
  });
  return user;
}

// ── Require an authenticated user (throws a Response-friendly sentinel) ──
export class Unauthorized extends Error {
  constructor() {
    super("Not authenticated");
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Unauthorized();
  return user;
}

// ── Destroy the current session ──
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await db.authSession.deleteMany({ where: { token } }).catch(() => {});
  }
  store.delete(COOKIE);
}

export const AUTH_COOKIE = COOKIE;
