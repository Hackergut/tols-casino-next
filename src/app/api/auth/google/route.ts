import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { googleEnabled, googleAuthUrl, oauthOrigin } from "@/lib/google-oauth";

// GET /api/auth/google — start Google OAuth. Sets a state cookie and redirects
// to Google consent. Never answers JSON: a 503 body used to replace the lobby
// when the Google button was an <a href>, and the client probe that tried to
// avoid that also hid the button on any network blip.
export async function GET(req: NextRequest) {
  const origin = oauthOrigin(req);
  if (!googleEnabled()) {
    return NextResponse.redirect(new URL("/?google=not_configured", origin + "/"));
  }
  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set("google_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });
  return NextResponse.redirect(googleAuthUrl(state, origin));
}
