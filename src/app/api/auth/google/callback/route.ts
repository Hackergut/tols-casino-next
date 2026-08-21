import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { createSession } from "@/lib/auth";
import { googleEnabled, exchangeGoogle } from "@/lib/google-oauth";
import { fireTelegramAlert } from "@/lib/telegram";
import { appUrl } from "@/lib/mailer";

// GET /api/auth/google/callback?code=&state= — exchange the code for the Google
// profile, upsert the user by googleId (linking an existing same-email account),
// issue a session, and redirect home.
//
// EVERY exit from this handler is a redirect. An OAuth callback must never
// answer with a body: the browser has just been bounced here by Google, and
// anything other than a 3xx renders (or downloads) at the callback URL itself.
//
// Redirects are built on appUrl() (the canonical APP_URL origin), not req.url:
// behind a proxy or a bind-all dev server req.url reflects the Host header the
// server saw (e.g. http://0.0.0.0:3000), and a Location assembled from it can
// point the player at an origin that doesn't exist outside the machine. The
// same APP_URL is what googleRedirectUri() registers with Google, so the two
// stay consistent by construction.
export async function GET(req: NextRequest) {
  const home = (q = "") => NextResponse.redirect(new URL("/" + q, appUrl()));

  if (!googleEnabled()) return home("?google=not_configured");
  const sp = new URL(req.url).searchParams;
  const code = sp.get("code") || "";
  const state = sp.get("state") || "";
  const store = await cookies();
  const expected = store.get("google_state")?.value;
  store.delete("google_state");
  if (!code || !expected || state !== expected) return home("?google=error");

  let profile;
  try { profile = await exchangeGoogle(code); } catch { return home("?google=error"); }
  if (!profile.sub || !profile.email) return home("?google=error");

  // The DB work is guarded for the same reason the exchange is: an unreachable
  // database must degrade to a clean redirect with an error flag, not a 500
  // page sitting on the callback URL.
  try {
    let user = await db.casinoUser.findUnique({ where: { googleId: profile.sub }, include: { wallet: true } });
    if (!user) {
      const existing = await db.casinoUser.findUnique({ where: { email: profile.email.toLowerCase() }, include: { wallet: true } });
      if (existing) {
        user = await db.casinoUser.update({ where: { id: existing.id }, data: { googleId: profile.sub, emailVerified: new Date() }, include: { wallet: true } });
      } else {
        const base = (profile.name || "player").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 12) || "player";
        let username = base;
        for (let i = 0; i < 6; i++) {
          const clash = await db.casinoUser.findUnique({ where: { username } }).catch(() => null);
          if (!clash) break;
          username = base + "_" + randomBytes(2).toString("hex");
        }
        user = await db.casinoUser.create({
          data: {
            username,
            email: profile.email.toLowerCase(),
            password: randomBytes(16).toString("hex"),
            role: "user",
            status: "active",
            googleId: profile.sub,
            emailVerified: new Date(),
            wallet: { create: { balance: 0, currency: "USDT" } },
          },
          include: { wallet: true },
        });
        fireTelegramAlert({ event: "registration", title: "Google sign-up", message: `User: ${username}\nEmail: ${profile.email}` });
      }
    }

    await createSession(user.id);
  } catch (e) {
    console.error("[google-oauth] callback failed:", e);
    return home("?google=error");
  }

  return home();
}
