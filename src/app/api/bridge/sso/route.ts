import { NextRequest, NextResponse } from "next/server";
import { createBridgeSsoToken, verifyBridgeSsoToken, getBridgeConfig } from "@/lib/governance-bridge";
import { createSession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Bridge SSO
 *
 * GET  /api/bridge/sso?token=<sso>     — verify a Tower-issued token and auto-login on Casino
 *                                      Redirects to / on success, 401 on failure.
 * POST /api/bridge/sso                 — Casino → Tower: mint a token for the current user (auth required)
 *
 * Both sides share GOVERNANCE_BRIDGE_SECRET to sign/verify.
 */

// Mint a SSO token for the currently authenticated Casino user (so Tower can log them in)
export async function POST() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

  let token: string;
  try {
    token = createBridgeSsoToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      issuedAt: Date.now(),
      nonce: Math.random().toString(36).slice(2, 10),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }

  const cfg = getBridgeConfig();
  // Tower should verify via GET ${towerOrigin}/api/bridge/sso?token=...  or Casino's counterpart
  const towerUrl = `${cfg.towerOrigin}/api/bridge/sso?token=${encodeURIComponent(token)}`;
  return NextResponse.json({ success: true, data: { token, towerUrl, expiresInSec: 600 } });
}

// Verify inbound Tower SSO token and create a Casino session (+ user if first time)
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  const payload = verifyBridgeSsoToken(token || undefined);

  if (!payload) {
    return NextResponse.json({ success: false, error: "Invalid or expired SSO token. Mint a fresh one from the other side (POST /api/bridge/sso while logged in)." }, { status: 401 });
  }

  // Find or create user by email or id mapping
  let user = payload.userId ? await db.casinoUser.findUnique({ where: { id: payload.userId } }).catch(() => null) : null;
  if (!user && payload.email) user = await db.casinoUser.findUnique({ where: { email: payload.email } }).catch(() => null);

  if (!user) {
    // Auto-provision bridged user (no password — SSO only)
    user = await db.casinoUser.create({
      data: {
        id: payload.userId || undefined,
        email: payload.email || `${payload.username || "bridge"}_${payload.userId.slice(0, 6)}@bridge.tols`,
        username: payload.username || `tower_${payload.userId.slice(0, 8)}`,
        password: "bridge-sso", // not usable for login
        wallet: { create: { balance: 0 } },
      },
    });
  }

  await createSession(user.id);

  // Browser flow: redirect to Casino home; API flow (Accept: application/json) gets JSON
  const wantsJson = req.headers.get("accept")?.includes("application/json");
  if (wantsJson) {
    return NextResponse.json({ success: true, data: { userId: user.id, username: user.username } });
  }
  const casinoOrigin = getBridgeConfig().casinoOrigin;
  return NextResponse.redirect(`${casinoOrigin}/`, 302);
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Bridge-Signature" } });
}
