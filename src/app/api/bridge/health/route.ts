import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBridgeConfig, bridgeFetch } from "@/lib/governance-bridge";
import { getGovernanceConnection } from "@/lib/governance-connection";

// GET /api/bridge/health — public bridge + system health for Vercel/monitoring
// Checks: db, bridge env, tower reachability (best-effort, never 5xx on tower down)
export async function GET(req: NextRequest) {
  const started = Date.now();
  const cfg = getBridgeConfig();
  const stored = await getGovernanceConnection().catch(() => null);
  const towerOrigin = stored?.enabled ? stored.towerOrigin : cfg.towerOrigin;
  const towerApiBase = stored?.enabled ? stored.towerApiBase : cfg.towerApiBase;
  const casinoOrigin = stored?.enabled ? stored.casinoOrigin : cfg.casinoOrigin;
  const searchParams = new URL(req.url).searchParams;
  const probeTower = searchParams.get("probe") !== "false"; // ?probe=false to skip outbound

  // DB probe
  let dbState: { ok: boolean; latencyMs?: number; error?: string } = { ok: false };
  const t0 = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    dbState = { ok: true, latencyMs: Date.now() - t0 };
  } catch (e) {
    dbState = { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300) };
  }

  // Tower reachability probe (best-effort, 4s timeout)
  let tower: { reachable: boolean | null; status?: number; latencyMs?: number; error?: string } = { reachable: null };
  if (probeTower) {
    const tt0 = Date.now();
    try {
      // HEAD the tower API base with bridge headers; many towers return 401 without keys — that's still \"reachable\"
      const res = await bridgeFetch({ path: stored?.healthPath || "", useOrigin: Boolean(stored?.healthPath), method: "GET", timeoutMs: 4000 });
      tower = { reachable: true, status: res.status, latencyMs: Date.now() - tt0 };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isTimeout = msg.includes("aborted") || msg.includes("AbortError");
      tower = { reachable: false, error: isTimeout ? "timeout" : msg.slice(0, 300), latencyMs: Date.now() - tt0 };
    }
  }

  const degraded = !dbState.ok;
  const body = {
    ok: !degraded,
    service: "tols-casino-bridge",
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - started,
    casino: { origin: casinoOrigin },
    tower: { origin: towerOrigin, apiBase: towerApiBase, ...tower },
    bridge: {
      configured: Boolean(stored?.enabled && stored.bridgeSecret) || cfg.hasBridgeSecret,
      source: stored?.enabled ? "database" : "environment",
      connectionId: stored?.enabled ? stored.id : null,
      hasTowerKeys: Boolean(stored?.apiKey && stored?.appKey) || cfg.hasTowerKeys,
      hasDb: cfg.hasDb,
      // never expose secret values
      envPresent: {
        DATABASE_CONNECTION: Boolean(stored?.enabled),
        GOVERNANCE_TOWER_URL: Boolean(process.env.GOVERNANCE_TOWER_URL),
        TOLS_BASE_URL: Boolean(process.env.TOLS_BASE_URL),
        APP_URL: Boolean(process.env.APP_URL),
        GOVERNANCE_BRIDGE_SECRET: cfg.hasBridgeSecret,
        GOVERNANCE_WEBHOOK_SECRET: Boolean(process.env.GOVERNANCE_WEBHOOK_SECRET),
        TOLS_API_KEY: Boolean(process.env.TOLS_API_KEY),
        TOLS_APP_KEY: Boolean(process.env.TOLS_APP_KEY),
      },
    },
    db: dbState,
  };

  // Always 200 so Vercel health checks don't flap when Tower is down; callers inspect .ok/.db.ok
  return NextResponse.json(body, { status: degraded ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Bridge-Signature" } });
}
