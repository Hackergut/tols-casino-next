import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { db } from "@/lib/db";

/*
 * Operator authentication.
 *
 * Every /api/ops/* and /api/admin/* route must call `requireAdmin` before it
 * touches data. Previously the only gate was a password compared in the
 * browser and shipped through NEXT_PUBLIC_ADMIN_PASSWORD — which is embedded
 * in the client bundle and therefore public — while the APIs behind it were
 * completely open: anyone who knew a URL could approve their own withdrawal or
 * repoint the deposit addresses.
 *
 * The session is a signed, httpOnly cookie. The signature is an HMAC over the
 * payload with ADMIN_SESSION_SECRET, so a client cannot mint or edit one.
 */

const COOKIE = "tols_admin";
const MAX_AGE_SECONDS = 60 * 60 * 8; // an operator shift

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) {
    // Fail closed: without a strong secret the signature is forgeable, so no
    // admin session can be issued or accepted at all.
    throw new Error("ADMIN_SESSION_SECRET missing or shorter than 32 chars");
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export interface AdminSession {
  userId: string;
  username: string;
  issuedAt: number;
}

export function createAdminToken(userId: string, username: string): string {
  const payload = JSON.stringify({ userId, username, issuedAt: Date.now() });
  const b64 = Buffer.from(payload).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

export function verifyAdminToken(token: string | undefined): AdminSession | null {
  if (!token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  if (!safeEqual(sig, sign(b64))) return null;
  try {
    const s = JSON.parse(Buffer.from(b64, "base64url").toString()) as AdminSession;
    if (Date.now() - s.issuedAt > MAX_AGE_SECONDS * 1000) return null;
    return s;
  } catch {
    return null;
  }
}

export async function setAdminCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // operator console is never embedded or cross-site
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return verifyAdminToken(store.get(COOKIE)?.value);
}

/**
 * Guard for operator routes. Returns a 401/403 Response when the caller is not
 * an operator — the route should return it as-is and do nothing else.
 */
export async function requireAdmin(): Promise<{ session: AdminSession } | { response: Response }> {
  let session: AdminSession | null = null;
  try {
    session = await getAdminSession();
  } catch (e) {
    // Misconfigured secret — refuse rather than fall open.
    return {
      response: Response.json(
        { success: false, error: "Admin auth is not configured" },
        { status: 503 },
      ),
    };
  }
  if (!session) {
    return {
      response: Response.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session };
}

/** Record an operator action so privileged changes are always attributable. */
export async function auditLog(
  session: AdminSession,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await db.crmActivity
    .create({
      data: {
        action,
        entityType: "admin",
        entityId: session.userId,
        details: JSON.stringify({ by: session.username, ...detail }).slice(0, 900),
      },
    })
    .catch(() => {}); // auditing must never break the action it records
}

/** Generate a value suitable for ADMIN_SESSION_SECRET. */
export function generateSecret(): string {
  return randomBytes(32).toString("hex");
}
