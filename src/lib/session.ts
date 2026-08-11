import { db } from "@/lib/db";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";

const DEMO_EMAIL = "demo@tols.gg";
const DEMO_ENABLED = process.env.NODE_ENV !== "production" && process.env.ENABLE_DEMO_USER !== "false";

// Returns the authenticated user if a valid session cookie is present.
// In development, falls back to a shared demo user so public/preview pages
// still work. In production the demo is disabled — every request must
// carry a real authenticated session.
export async function getSession() {
  const authed = await getCurrentUser();
  if (authed) return authed;
  if (!DEMO_ENABLED) {
    // Production: return a minimal unauthenticated shell so routes that
    // check wallet/null can respond gracefully without exposing data.
    throw new Error("Not authenticated");
  }

  let user = await db.casinoUser.findUnique({
    where: { email: DEMO_EMAIL },
    include: { wallet: true },
  });
  if (!user) {
    user = await db.casinoUser.create({
      data: {
        username: "TOLSPlayer",
        email: DEMO_EMAIL,
        role: "user",
        status: "active",
        avatarColor: "#ccff00",
        level: 7,
        xp: 4820,
        wallet: { create: { balance: 1000, currency: "USDT", vipLevel: 3, totalWagered: 28450, totalWon: 31200 } },
      },
      include: { wallet: true },
    });
  }
  return user;
}

export async function getSessionId() {
  const u = await getSession();
  return u.id;
}

// Simple API response helpers
export function ok(data: unknown, status = 200) {
  return Response.json({ success: true, data }, { status });
}
export function err(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status });
}

// Provably-fair RNG utilities — re-exported from types
export { fairFloat, serverSeedHash } from "@/lib/types";
