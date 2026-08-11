import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { googleEnabled, googleAuthUrl } from "@/lib/google-oauth";
import { err } from "@/lib/session";

// GET /api/auth/google — start Google OAuth. Sets a state cookie and redirects
// to Google consent.
export async function GET() {
  if (!googleEnabled()) return err("Google login is not configured", 503);
  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set("google_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return NextResponse.redirect(googleAuthUrl(state));
}
