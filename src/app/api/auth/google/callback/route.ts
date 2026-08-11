import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { createSession } from "@/lib/auth";
import { googleEnabled, exchangeGoogle } from "@/lib/google-oauth";
import { fireTelegramAlert } from "@/lib/telegram";

// GET /api/auth/google/callback?code=&state= — exchange the code for the Google
// profile, upsert the user by googleId (linking an existing same-email account),
// issue a session, and redirect home.
export async function GET(req: NextRequest) {
  if (!googleEnabled()) return NextResponse.redirect(new URL("/?google=not_configured", req.url));
  const sp = new URL(req.url).searchParams;
  const code = sp.get("code") || "";
  const state = sp.get("state") || "";
  const store = await cookies();
  const expected = store.get("google_state")?.value;
  store.delete("google_state");
  if (!code || !expected || state !== expected) return NextResponse.redirect(new URL("/?google=error", req.url));

  let profile;
  try { profile = await exchangeGoogle(code); } catch { return NextResponse.redirect(new URL("/?google=error", req.url)); }
  if (!profile.sub || !profile.email) return NextResponse.redirect(new URL("/?google=error", req.url));

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
  return NextResponse.redirect(new URL("/", req.url));
}
