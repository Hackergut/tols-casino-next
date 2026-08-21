import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBridgeConfig, loadActiveGovernanceConnection, probeGovernanceHealth, pushBridgeEvent } from "@/lib/governance-bridge";

// GET /api/bridge/health — public bridge + system health for Vercel/monitoring
// Checks: db, bridge env, tower reachability (best-effort, never 5xx on tower down)
export async function GET(req: NextRequest) {
  const started = Date.now();
  const cfg = getBridgeConfig();
  const stored = await loadActiveGovernanceConnection();
  const towerOrigin = stored?.towerOrigin || cfg.towerOrigin;
  const towerApiBase = stored?.towerApiBase || cfg.towerApiBase;
  const casinoOrigin = stored?.casinoOrigin || cfg.casinoOrigin;
  const searchParams = new URL(req.url).searchParams;
  const probeTower = searchParams.get("probe") !== "false";
  const heartbeat = searchParams.get("heartbeat") === "1";

  let dbState: { ok: boolean; latencyMs?: number; error?: string } = { ok: false };
  const t0 = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    dbState = { ok: true, latencyMs: Date.now() - t0 };
  } catch (e) {
    dbState = { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300) };
  }

  let tower: {
    reachable: boolean | null;
    status?: number;
    latencyMs?: number;
    error?: string;
    url?: string;
  } = { reachable: null };
  if (probeTower) {
    tower = await probeGovernanceHealth(4000);
  }

  const secretReady = Boolean(stored?.bridgeSecret) || cfg.hasBridgeSecret;
  const jwtReady = Boolean(process.env.PLATFORM_JWT_PUBLIC_KEY);
  const live = Boolean(dbState.ok && tower.reachable && secretReady);
  const degraded = !dbState.ok;

  if (heartbeat && tower.reachable) {
    after(() =>
      pushBridgeEvent("casino.health", {
        casinoOrigin,
        db: dbState.ok,
        towerStatus: tower.status ?? null,
        latencyMs: tower.latencyMs ?? null,
      }).catch(() => {}),
    );
  }

  const body = {
    ok: !degraded,
    service: "tols-casino-bridge",
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - started,
    casino: { origin: casinoOrigin },
    tower: { origin: towerOrigin, apiBase: towerApiBase, ...tower },
    link: {
      live,
      status: live ? "live" : tower.reachable ? "degraded" : "offline",
      source: stored ? "database" : "environment",
      secretReady,
      jwtReady,
    },
    bridge: {
      configured: secretReady,
      source: stored ? "database" : "environment",
      connectionId: stored ? stored.id : null,
      hasTowerKeys: Boolean(stored?.apiKey && stored?.appKey) || cfg.hasTowerKeys,
      hasDb: cfg.hasDb,
      envPresent: {
        DATABASE_CONNECTION: Boolean(stored),
        GOVERNANCE_TOWER_URL: Boolean(process.env.GOVERNANCE_TOWER_URL),
        TOLS_BASE_URL: Boolean(process.env.TOLS_BASE_URL),
        APP_URL: Boolean(process.env.APP_URL),
        GOVERNANCE_BRIDGE_SECRET: cfg.hasBridgeSecret,
        GOVERNANCE_WEBHOOK_SECRET: Boolean(process.env.GOVERNANCE_WEBHOOK_SECRET),
        PLATFORM_JWT_PUBLIC_KEY: jwtReady,
        TOLS_API_KEY: Boolean(process.env.TOLS_API_KEY),
        TOLS_APP_KEY: Boolean(process.env.TOLS_APP_KEY),
      },
    },
    db: dbState,
  };

  return NextResponse.json(body, { status: degraded ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Bridge-Signature",
    },
  });
}
