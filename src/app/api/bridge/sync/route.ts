import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getBridgeConfig, bridgeFetch, pushBridgeEvent } from "@/lib/governance-bridge";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";

// GET /api/bridge/sync — admin check what would be synced
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const cfg = getBridgeConfig();
  const counts = await Promise.all([
    db.casinoBet.count().catch(() => 0),
    db.casinoDeposit.count().catch(() => 0),
    db.casinoWithdrawal.count({ where: { status: "pending" } }).catch(() => 0),
    db.operationControl.count({ where: { enabled: true } }).catch(() => 0),
  ]);

  return ok({
    towerOrigin: cfg.towerOrigin,
    towerApiBase: cfg.towerApiBase,
    casinoOrigin: cfg.casinoOrigin,
    bridgeConfigured: cfg.hasBridgeSecret,
    pending: {
      bets: counts[0],
      deposits: counts[1],
      withdrawalsPending: counts[2],
      activeControls: counts[3],
    },
    hint: "POST /api/bridge/sync to push a sync event to the Tower.",
  });
}

// POST /api/bridge/sync — admin-triggered sync Casino → Tower
// Body: { dryRun?: boolean }
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const cfg = getBridgeConfig();
  const body = await req.json().catch(() => ({})) as { dryRun?: boolean };
  const dryRun = body.dryRun === true;

  // Gather a small snapshot to push (counts only, no PII dump)
  const snapshot = {
    ts: new Date().toISOString(),
    casinoOrigin: cfg.casinoOrigin,
    counts: {
      bets: await db.casinoBet.count().catch(() => 0),
      pendingWithdrawals: await db.casinoWithdrawal.count({ where: { status: "pending" } }).catch(() => 0),
      activeControls: await db.operationControl.count({ where: { enabled: true } }).catch(() => 0),
    },
  };

  if (dryRun) {
    return ok({ dryRun: true, snapshot, towerOrigin: cfg.towerOrigin, note: "Dry run — nothing pushed." });
  }

  // Try to reach Tower's health/bridge endpoint — best-effort
  let towerProbe: { ok: boolean; status: number; body?: unknown } | null = null;
  try {
    const r = await bridgeFetch({ path: "/bridge/sync", method: "POST", body: { type: "bridge.sync_request", payload: snapshot, source: "casino", ts: new Date().toISOString() }, timeoutMs: 6000 });
    const t = await r.text();
    let b: unknown = t; try { b = JSON.parse(t); } catch {}
    towerProbe = { ok: r.ok, status: r.status, body: b };
  } catch (e) {
    towerProbe = { ok: false, status: 0, body: { error: e instanceof Error ? e.message : String(e) } };
  }

  // Also emit via generic bridge event for towers that listen on /bridge/events
  const eventRes = await pushBridgeEvent("bridge.sync_request", snapshot as unknown as Record<string, unknown>);

  // Record audit
  await db.crmActivity.create({
    data: { action: "bridge_sync", entityType: "bridge", entityId: "casino->tower", details: JSON.stringify({ by: guard.session.username, dryRun: false, snapshot }).slice(0, 900) },
  }).catch(() => {});

  return ok({
    snapshot,
    towerProbe,
    eventPush: eventRes,
    towerOrigin: cfg.towerOrigin,
    bridgeConfigured: cfg.hasBridgeSecret,
    note: towerProbe?.ok ? "Sync delivered to Tower." : "Casino snapshot ready — Tower did not acknowledge (check TOLS_API_KEY / GOVERNANCE_TOWER_URL / tower bridge route).",
  });
}
