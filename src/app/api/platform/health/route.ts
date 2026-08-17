import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/platform/health — pubblico, no JWT
 * Usato dalla Governance Tower per verificare che il Casino sia up + DB ok.
 * Questo è il primo check che elimina i mockup: se torna 200, la Tower sa che può chiamare /deposits ecc.
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
    casino: { origin: process.env.APP_URL || "https://tols.fun" },
    db: { ok: dbOk, latencyMs: dbLatency, error: dbError },
    bridge: {
      jwtConfigured: bridgeEnv.PLATFORM_JWT_PUBLIC_KEY,
      env: bridgeEnv,
      endpoints: [
        "GET /api/platform/health",
        "GET /api/platform/whoami",
        "GET /api/platform/deposits",
        "GET /api/platform/withdrawals",
        "POST /api/platform/withdrawals/:id/approve",
        "POST /api/platform/withdrawals/:id/reject",
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
