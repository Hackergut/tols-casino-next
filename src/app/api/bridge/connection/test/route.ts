import { createHmac } from "crypto";
import { requireAdmin, auditLog } from "@/lib/admin-auth";
import { getGovernanceConnection, publicGovernanceConnection, recordGovernanceConnectionTest } from "@/lib/governance-connection";

async function request(connection: NonNullable<Awaited<ReturnType<typeof getGovernanceConnection>>>, url: string, method = "GET", body?: unknown) {
  const raw = body === undefined ? undefined : JSON.stringify(body);
  const headers: Record<string, string> = {
    Accept: "application/json", "Content-Type": "application/json", "X-Bridge-Source": "tols-casino",
    "X-Casino-Origin": connection.casinoOrigin, "X-Bridge-Timestamp": String(Math.floor(Date.now() / 1000)),
  };
  if (connection.apiKey) { headers["x-api-key"] = connection.apiKey; headers.api_key = connection.apiKey; }
  if (connection.appKey) { headers["x-app-key"] = connection.appKey; headers.app_key = connection.appKey; }
  if (raw) headers["x-bridge-signature"] = `sha256=${createHmac("sha256", connection.bridgeSecret).update(raw).digest("hex")}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try { return await fetch(url, { method, headers, body: raw, cache: "no-store", signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function POST() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const connection = await getGovernanceConnection().catch(() => null);
  if (!connection) return Response.json({ success: false, error: "Create and save a Governance connection first" }, { status: 404 });
  const started = Date.now();
  try {
    const healthUrl = new URL(connection.healthPath || "/api/platform/health", `${connection.towerOrigin}/`).toString();
    const health = await request(connection, healthUrl);
    const healthText = await health.text();
    let healthBody: unknown = healthText; try { healthBody = JSON.parse(healthText); } catch {}
    if (!health.ok) {
      const tested = await recordGovernanceConnectionTest({ ok: false, latencyMs: Date.now() - started, httpStatus: health.status, error: `Health returned HTTP ${health.status}` });
      return Response.json({ success: false, error: `Governance health returned HTTP ${health.status}`, data: { connection: publicGovernanceConnection(tested), health: healthBody } }, { status: 502 });
    }
    const registration = {
      type: "casino", name: connection.name, casinoOrigin: connection.casinoOrigin,
      webhookUrl: `${connection.casinoOrigin}/api/bridge/webhook`, platformApiUrl: `${connection.casinoOrigin}/api/platform`,
      capabilities: ["players:read", "bets:read", "deposits:read", "withdrawals:read", "withdrawals:write", "events:write"],
      protocol: "tols-bridge-v1", timestamp: new Date().toISOString(),
    };
    const candidates = [connection.webhookPath || "", "/api/platform/connections", "/api/bridge/connect", "/bridge/connect"]
      .filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
    let registrationResult: { ok: boolean; status: number; body: unknown; path: string } | null = null;
    for (const path of candidates) {
      const response = await request(connection, new URL(path, `${connection.towerOrigin}/`).toString(), "POST", registration);
      const text = await response.text(); let parsed: unknown = text; try { parsed = JSON.parse(text); } catch {}
      if (response.status === 404) continue;
      registrationResult = { ok: response.ok, status: response.status, body: parsed, path };
      break;
    }
    const registrationError = registrationResult && !registrationResult.ok ? `Registration returned HTTP ${registrationResult.status}` : undefined;
    const tested = await recordGovernanceConnectionTest({ ok: !registrationError, latencyMs: Date.now() - started, httpStatus: registrationResult?.status ?? health.status, error: registrationError });
    await auditLog(guard.session, "governance.connection.test", { towerOrigin: connection.towerOrigin, healthStatus: health.status, registration: registrationResult ? { path: registrationResult.path, status: registrationResult.status } : "legacy-no-registration-route" });
    if (registrationResult && !registrationResult.ok) return Response.json({ success: false, error: `Governance registration rejected with HTTP ${registrationResult.status}`, data: { connection: publicGovernanceConnection(tested), health: healthBody, registration: registrationResult } }, { status: 502 });
    return Response.json({ success: true, data: { connected: true, connection: publicGovernanceConnection(tested), health: healthBody, registration: registrationResult ?? { mode: "legacy-signed-webhook", accepted: true }, latencyMs: Date.now() - started } });
  } catch (error) {
    const message = error instanceof Error ? error.name === "AbortError" ? "Connection timed out" : error.message : "Connection failed";
    const tested = await recordGovernanceConnectionTest({ ok: false, latencyMs: Date.now() - started, httpStatus: null, error: message }).catch(() => null);
    return Response.json({ success: false, error: message, data: { connection: publicGovernanceConnection(tested) } }, { status: 502 });
  }
}
