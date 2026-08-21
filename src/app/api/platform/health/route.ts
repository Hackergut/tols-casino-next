import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/platform/health — public, no JWT.
 * Used by the Governance Tower to verify the Casino is up and the DB is OK.
 * This is the first check that removes the mocks: on a 200 the Tower knows it can call /deposits etc.
 */
export async function GET() {
  const started = Date.now();
  let dbOk = false;
  let dbLatency: number | null = null;
  let dbError: string | null = null;
  const t0 = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
    dbLatency = Date.now() - t0;
  } catch (e) {
    dbError = e instanceof Error ? e.message.slice(0, 400) : String(e).slice(0, 400);
  }

  const bridgeEnv = {
    PLATFORM_JWT_PUBLIC_KEY: Boolean(process.env.PLATFORM_JWT_PUBLIC_KEY),
    PLATFORM_JWT_ISSUER: process.env.PLATFORM_JWT_ISSUER || "tols-governance",
    PLATFORM_JWT_AUDIENCE: process.env.PLATFORM_JWT_AUDIENCE || "tols-casino",
    GOVERNANCE_BRIDGE_SECRET: Boolean(process.env.GOVERNANCE_BRIDGE_SECRET || process.env.GOVERNANCE_WEBHOOK_SECRET),
    GOVERNANCE_TOWER_URL: Boolean(process.env.GOVERNANCE_TOWER_URL || process.env.TOWER_URL),
    APP_URL: Boolean(process.env.APP_URL),
  };

  const body = {
    success: true,
    service: "tols-casino-platform-bridge",
    status: dbOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - started,
    casino: { origin: process.env.APP_URL || "https://www.tols.fun" },
    db: { ok: dbOk, latencyMs: dbLatency, error: dbError },
    bridge: {
      jwtConfigured: bridgeEnv.PLATFORM_JWT_PUBLIC_KEY,
      env: bridgeEnv,
      endpoints: [
        "GET /api/platform",
        "GET /api/platform/health",
        "GET /api/platform/whoami",
        "GET /api/platform/overview",
        "GET /api/platform/users",
        "PATCH /api/platform/users/:id",
        "GET /api/platform/wallets",
        "POST /api/platform/wallets/adjust",
        "GET /api/platform/deposits",
        "GET /api/platform/withdrawals",
        "POST /api/platform/withdrawals/:id/approve",
        "POST /api/platform/withdrawals/:id/reject",
        "GET /api/platform/cashflow",
        "GET /api/platform/bets",
        "GET|PUT /api/platform/rtp",
        "GET|PUT /api/platform/promotions",
        "GET /api/platform/payments",
        "GET /api/platform/stats",
      ],
    },
  };

  return NextResponse.json(body, { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
}
