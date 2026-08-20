import { createHmac, timingSafeEqual } from "crypto";

/**
 * TOLS Casino ↔ Governance — Project-to-Project Bridge (hackguts-projects)
 *
 *   - Casino      → Vercel hackguts-projects/tols-casino-next → https://vercel.com/hackguts-projects/tols-casino-next
 *                   domini: prendi da Vercel → Settings → Domains (es. tols.fun o tols-casino-next.vercel.app)
 *   - Governance  → Vercel hackguts-projects/tolsgovernz       → https://vercel.com/hackguts-projects/tolsgovernz
 *                   domini: prendi da Vercel → Settings → Domains (es. tolsgovernz.vercel.app)
 *
 * Il ponte NON è via admin panel — è service-to-service via HTTPS + HMAC/JWT tra i 2 progetti.
 *
 * Flusso:
 *   Casino → Governance: health, sync, deposits/withdrawals reali via /api/platform/* (JWT RS256)
 *   Governance → Casino: commands via /api/bridge/webhook (HMAC)
 *   SSO: token HMAC 10m
 *
 * Env su ENTRAMBI i progetti (stesso secret):
 *   GOVERNANCE_TOWER_URL  — origin Governance, es. https://gov.tols.fun (alias: TOWER_URL) — copia da Vercel → tolsgovernz → Domains
 *   APP_URL               — origin Casino, es. https://www.tols.fun (alias: CASINO_URL) — copia da Vercel → tols-casino-next → Domains
 *   GOVERNANCE_BRIDGE_SECRET / GOVERNANCE_WEBHOOK_SECRET — HMAC condiviso (openssl rand -hex 32)
 *   TOLS_BASE_URL         — legacy base API Governance (es. https://gov.tols.fun/api)
 *   PLATFORM_JWT_*        — JWT RS256: PRIVATE su tolsgovernz, PUBLIC su tols-casino-next (vedi .env.bridge-keys)
 */

// ── Config ───────────────────────────────────────────────────────────────

export interface BridgeConfig {
  towerOrigin: string;        // es. https://gov.tols.fun
  towerApiBase: string;       // es. https://gov.tols.fun/api
  casinoOrigin: string;       // es. https://www.tols.fun
  hasBridgeSecret: boolean;
  hasTowerKeys: boolean;
  hasDb: boolean;
}

function stripTrailingSlash(s: string) { return s.replace(/\/+$/, ""); }

function pickEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

export function getBridgeConfig(): BridgeConfig {
  // Tower origin: prefer GOVERNANCE_TOWER_URL / TOWER_URL, fallback to origin di TOLS_BASE_URL
  const rawTowerOrigin = pickEnv("GOVERNANCE_TOWER_URL", "TOWER_URL");
  const rawApiBase = pickEnv("TOLS_BASE_URL", "TOWER_API_BASE");
  const towerApiBase = stripTrailingSlash(rawApiBase || "https://gov.tols.fun/api");
  const towerOrigin = rawTowerOrigin
    ? stripTrailingSlash(rawTowerOrigin)
    : (() => { try { return new URL(towerApiBase).origin; } catch { return "https://gov.tols.fun"; } })();

  // Casino origin: prefer APP_URL, fallback CASINO_URL / NEXT_PUBLIC_APP_URL
  const casinoOrigin = stripTrailingSlash(pickEnv("APP_URL", "CASINO_URL", "NEXT_PUBLIC_APP_URL") || "https://www.tols.fun");
  const bridgeSecret = pickEnv("GOVERNANCE_BRIDGE_SECRET", "GOVERNANCE_WEBHOOK_SECRET") || "";
  const hasTowerKeys = Boolean(process.env.TOLS_API_KEY && process.env.TOLS_APP_KEY);

  return {
    towerOrigin,
    towerApiBase,
    casinoOrigin,
    hasBridgeSecret: bridgeSecret.length >= 16,
    hasTowerKeys,
    hasDb: Boolean(process.env.DATABASE_URL),
  };
}

// ── HMAC helpers ─────────────────────────────────────────────────────────

function bridgeSecret(): string {
  return (pickEnv("GOVERNANCE_BRIDGE_SECRET", "GOVERNANCE_WEBHOOK_SECRET") || "").trim();
}

export function signBridgePayload(payload: string, secretOverride?: string): string {
  const secret = secretOverride || bridgeSecret();
  if (!secret) throw new Error("GOVERNANCE_BRIDGE_SECRET not configured — imposta lo stesso secret su Casino e Tower (Vercel → Settings → Environment Variables)");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signBridgeBody(body: unknown): string {
  return signBridgePayload(typeof body === "string" ? body : JSON.stringify(body));
}

export function verifyBridgeSignature(rawBody: string, signature: string | null, secretOverride?: string): boolean {
  const secret = secretOverride || bridgeSecret();
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase().replace(/^sha256=/, ""), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Verify with the encrypted DB connection first, then environment fallback. */
export async function verifyRuntimeBridgeSignature(rawBody: string, signature: string | null): Promise<boolean> {
  try {
    const { getGovernanceConnection } = await import("@/lib/governance-connection");
    const connection = await getGovernanceConnection();
    if (connection?.enabled && connection.bridgeSecret) return verifyBridgeSignature(rawBody, signature, connection.bridgeSecret);
  } catch { /* env-only deployments remain supported */ }
  return verifyBridgeSignature(rawBody, signature);
}

// ── Outbound helper (Casino → Tower) ────────────────────────────────────
// Funziona anche sottodominio: chiama direttamente l'altro progetto Vercel via HTTPS.

export interface BridgeFetchOpts {
  path?: string;              // appende a towerApiBase, es. "/health" o "/bridge/webhook"
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  // Se true usa towerOrigin invece di towerApiBase (utile quando la Tower non ha /api)
  useOrigin?: boolean;
}

/**
 * Chiama la Governance Tower (altro progetto Vercel su sottodominio).
 * Usa TOLS_API_KEY / TOLS_APP_KEY se la Tower li richiede.
 */
export async function bridgeFetch(opts: BridgeFetchOpts = {}): Promise<Response> {
  const envConfig = getBridgeConfig();
  let stored: import("@/lib/governance-connection").GovernanceConnection | null = null;
  try {
    const { getGovernanceConnection } = await import("@/lib/governance-connection");
    stored = await getGovernanceConnection();
    if (stored && !stored.enabled) stored = null;
  } catch { /* use environment configuration */ }
  const towerApiBase = stored?.towerApiBase || envConfig.towerApiBase;
  const towerOrigin = stored?.towerOrigin || envConfig.towerOrigin;
  const casinoOrigin = stored?.casinoOrigin || envConfig.casinoOrigin;
  const base = opts.useOrigin ? towerOrigin : towerApiBase;
  const apiKey = stored?.apiKey || process.env.TOLS_API_KEY || "";
  const appKey = stored?.appKey || process.env.TOLS_APP_KEY || "";
  const path = opts.path || "";
  const url = path ? `${base}${path.startsWith("/") ? path : `/${path}`}` : base;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Bridge-Source": "tols-casino",
    "X-Casino-Origin": casinoOrigin,
    ...(opts.headers || {}),
  };
  if (apiKey) { headers["x-api-key"] = apiKey; headers["api_key"] = apiKey; }
  if (appKey) { headers["x-app-key"] = appKey; headers["app_key"] = appKey; }

  const runtimeSecret = stored?.bridgeSecret || bridgeSecret();
  if (runtimeSecret && opts.body !== undefined) {
    const raw = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    headers["x-bridge-signature"] = `sha256=${signBridgePayload(raw, runtimeSecret)}`;
    headers["x-bridge-timestamp"] = String(Math.floor(Date.now() / 1000));
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);

  try {
    return await fetch(url, {
      method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? (typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

// ── Event push (Casino → Tower) ─────────────────────────────────────────

export type BridgeEventType =
  | "casino.bet"
  | "casino.win"
  | "casino.deposit_pending"
  | "casino.deposit_confirmed"
  | "casino.withdrawal_pending"
  | "casino.withdrawal_settled"
  | "casino.session_start"
  | "casino.session_end"
  | "casino.health"
  | "bridge.sync_request";

export async function pushBridgeEvent(type: BridgeEventType, payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; body?: unknown }> {
  const body = { type, payload, ts: new Date().toISOString(), source: "casino" };
  // La Governance (gov.tols.fun) espone secondo UI: /api/platform/webhooks (events:write)
  // Manteniamo fallback su /bridge/events per retrocompatibilità
  let configuredWebhook: string | null = null;
  try {
    const { getGovernanceConnection } = await import("@/lib/governance-connection");
    configuredWebhook = (await getGovernanceConnection())?.webhookPath || null;
  } catch { /* environment fallback */ }
  const candidates: Array<{ path: string; useOrigin?: boolean }> = [
    ...(configuredWebhook ? [{ path: configuredWebhook, useOrigin: true }] : []),
    { path: "/api/platform/webhooks", useOrigin: true },
    { path: "/api/platform/webhook", useOrigin: true },
    { path: "/bridge/events" },
    { path: "/api/bridge/events", useOrigin: true },
  ];
  for (const c of candidates) {
    try {
      const res = await bridgeFetch({ path: c.path, method: "POST", body, useOrigin: c.useOrigin });
      if (res.status === 404) continue; // prova prossimo
      const text = await res.text();
      let b: unknown = text; try { b = JSON.parse(text); } catch {}
      // se 401/403 per scope, riporta subito (non provare altri)
      if (res.status === 401 || res.status === 403) return { ok: res.ok, status: res.status, body: b };
      if (res.ok) return { ok: true, status: res.status, body: b };
      // altro errore ma non 404: ritorna comunque per debug
      return { ok: res.ok, status: res.status, body: b };
    } catch (e) {
      // network error: prova prossimo candidate se ce ne sono
      if (c !== candidates[candidates.length - 1]) continue;
      return { ok: false, status: 0, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
  return { ok: false, status: 404, body: { error: "All webhook candidates returned 404" } };
}

// ── Inbound event handling (Tower → Casino) ──────────────────────────────

export type InboundBridgeEvent =
  | { type: "governance.rtp_update"; payload: { gameId?: string; userId?: string; mode: string; rtpTarget?: number } }
  | { type: "governance.limits_update"; payload: { userId?: string; limits: Record<string, unknown> } }
  | { type: "governance.feature_flag"; payload: { flag: string; enabled: boolean } }
  | { type: "governance.session_invalidate"; payload: { userId: string } }
  | { type: "governance.wallet_adjust"; payload: { userId: string; amount: number; reason?: string } }
  | { type: "governance.player_block"; payload: { userId: string; blocked: boolean } }
  | { type: "ping"; payload: Record<string, unknown> };

export function isKnownInboundType(t: string): boolean {
  return ["governance.rtp_update","governance.limits_update","governance.feature_flag","governance.session_invalidate","governance.wallet_adjust","governance.player_block","ping"].includes(t);
}

// ── SSO: cross-domain token (Tower ↔ Casino) — sottodomini .tols.fun ────
// Con cookie su .tols.fun i due progetti possono condividere sessione; il token HMAC è il fallback quando i cookie non bastano.

export interface BridgeSsoPayload {
  userId: string;
  email?: string;
  username?: string;
  issuedAt: number;
  nonce: string;
}

export function createBridgeSsoToken(payload: BridgeSsoPayload, secretOverride?: string): string {
  const secret = secretOverride || bridgeSecret();
  if (!secret) throw new Error("GOVERNANCE_BRIDGE_SECRET not configured");
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

export function verifyBridgeSsoToken(token: string | undefined, secretOverride?: string): BridgeSsoPayload | null {
  if (!token) return null;
  const secret = secretOverride || bridgeSecret();
  if (!secret) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expected = createHmac("sha256", secret).update(b64).digest("hex");
  const a = Buffer.from(expected); const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(b64, "base64url").toString()) as BridgeSsoPayload;
    if (Date.now() - p.issuedAt > 10 * 60 * 1000) return null;
    return p;
  } catch { return null; }
}
