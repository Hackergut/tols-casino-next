import { NextRequest } from "next/server";
import { appUrl } from "@/lib/mailer";

/* Google OAuth (manual, no next-auth). Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
 *
 * redirect_uri is derived from the request Host (www vs apex) so the cookie set
 * at /api/auth/google and the callback Google returns to are the same origin.
 * APP_URL remains the fallback when Host is missing. Both hosts should be in
 * Google Cloud Console → Credentials → Authorized redirect URIs.
 */

export function googleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Public origin of this request (honours x-forwarded-* behind Vercel/Caddy). */
export function oauthOrigin(req: NextRequest): string {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  if (host) return `${proto}://${host}`.replace(/\/+$/, "");
  return appUrl();
}

export function googleRedirectUri(origin?: string): string {
  return (origin || appUrl()) + "/api/auth/google/callback";
}

export function googleAuthUrl(state: string, origin?: string): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID as string);
  u.searchParams.set("redirect_uri", googleRedirectUri(origin));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "select_account");
  return u.toString();
}

export interface GoogleProfile { sub: string; email: string; name: string; }

export async function exchangeGoogle(code: string, origin?: string): Promise<GoogleProfile> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: googleRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const t = (await r.json()) as { access_token?: string };
  if (!t.access_token) throw new Error("google token exchange failed");
  const ui = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${t.access_token}` },
  })).json() as { sub?: string; email?: string; name?: string };
  return { sub: String(ui.sub ?? ""), email: String(ui.email ?? ""), name: String(ui.name ?? "") };
}
