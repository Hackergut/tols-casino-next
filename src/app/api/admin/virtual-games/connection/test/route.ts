import { createHash } from "crypto";
import { requireAdmin, auditLog } from "@/lib/admin-auth";
import { evSignature } from "@/lib/eurovirtuals";
import {
  getEurovirtualsConnection,
  publicEurovirtualsConnection,
  recordEurovirtualsConnectionTest,
  evRuntimeCredentials,
} from "@/lib/eurovirtuals-connection";

export async function POST() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const stored = await getEurovirtualsConnection().catch(() => null);
  const creds = stored?.enabled
    ? { apiBase: stored.apiBase, apiKey: stored.apiKey, appKey: stored.appKey }
    : await evRuntimeCredentials();
  if (!creds) return Response.json({ success: false, error: "Save an EuroVirtuals connection or set EV_API_BASE / EV_API_KEY / EV_APP_KEY" }, { status: 404 });

  const started = Date.now();
  const body: Record<string, unknown> = {};
  try {
    const res = await fetch(`${creds.apiBase.replace(/\/+$/, "")}/v1/games`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": creds.apiKey,
        "x-signature-key": evSignature(body, creds.appKey),
        "x-timestamp": String(Math.floor(Date.now() / 1000)),
      },
      cache: "no-store",
    });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }
    const ok = res.ok && (typeof parsed !== "object" || parsed === null || (parsed as { status_code?: number }).status_code === 200 || res.status === 200);
    const tested = stored
      ? await recordEurovirtualsConnectionTest({ ok, latencyMs: Date.now() - started, httpStatus: res.status, error: ok ? undefined : `HTTP ${res.status}` })
      : null;
    await auditLog(guard.session, "eurovirtuals.connection.test", { apiBase: creds.apiBase, status: res.status });
    if (!ok) {
      return Response.json({
        success: false,
        error: `EuroVirtuals returned HTTP ${res.status}`,
        data: { connection: publicEurovirtualsConnection(tested), body: parsed, fingerprint: createHash("sha1").update(creds.apiBase).digest("hex").slice(0, 8) },
      }, { status: 502 });
    }
    return Response.json({
      success: true,
      data: {
        connected: true,
        connection: publicEurovirtualsConnection(tested),
        latencyMs: Date.now() - started,
        httpStatus: res.status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? (error.name === "AbortError" ? "Connection timed out" : error.message) : "Connection failed";
    const tested = stored
      ? await recordEurovirtualsConnectionTest({ ok: false, latencyMs: Date.now() - started, httpStatus: null, error: message }).catch(() => null)
      : null;
    return Response.json({ success: false, error: message, data: { connection: publicEurovirtualsConnection(tested) } }, { status: 502 });
  }
}
