import { requireAdmin } from "@/lib/admin-auth";
import { getBridgeConfig } from "@/lib/governance-bridge";
import { getGovernanceConnection, publicGovernanceConnection } from "@/lib/governance-connection";

// GET /api/bridge/config — admin-only bridge diagnostics (no secrets)
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const cfg = getBridgeConfig();
  const stored = await getGovernanceConnection().catch(() => null);
  return Response.json({
    success: true,
    data: {
      towerOrigin: stored?.towerOrigin || cfg.towerOrigin,
      towerApiBase: stored?.towerApiBase || cfg.towerApiBase,
      casinoOrigin: stored?.casinoOrigin || cfg.casinoOrigin,
      configured: Boolean(stored?.enabled && stored.bridgeSecret) || cfg.hasBridgeSecret,
      source: stored?.enabled ? "database" : "environment",
      connection: publicGovernanceConnection(stored),
      hasTowerKeys: cfg.hasTowerKeys,
      hasDb: cfg.hasDb,
      env: {
        GOVERNANCE_TOWER_URL: Boolean(process.env.GOVERNANCE_TOWER_URL),
        TOLS_BASE_URL: Boolean(process.env.TOLS_BASE_URL),
        APP_URL: Boolean(process.env.APP_URL),
        GOVERNANCE_BRIDGE_SECRET: cfg.hasBridgeSecret,
        GOVERNANCE_WEBHOOK_SECRET: Boolean(process.env.GOVERNANCE_WEBHOOK_SECRET),
        TOLS_API_KEY: Boolean(process.env.TOLS_API_KEY),
        TOLS_APP_KEY: Boolean(process.env.TOLS_APP_KEY),
        ADMIN_SESSION_SECRET: Boolean(process.env.ADMIN_SESSION_SECRET),
        DATABASE_URL: Boolean(process.env.DATABASE_URL),
        DIRECT_URL: Boolean(process.env.DIRECT_URL),
      },
      endpoints: {
        health: "/api/bridge/health",
        config: "/api/bridge/config",
        sync: "/api/bridge/sync",
        webhook: "/api/bridge/webhook",
        sso: "/api/bridge/sso",
        tolsProxy: "/api/tols",
      },
      dns: {
        casino: cfg.casinoOrigin,
        tower: cfg.towerOrigin,
        note: "Both domains must have CORS and CSP allowed for the bridge.",
      },
    },
  });
}
