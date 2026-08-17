import { createHmac, timingSafeEqual } from "crypto";

/**
 * TOLS Governance Tower ↔ Casino Platform Bridge
 *
 * Casino is the gaming frontend (this Next.js app, domain tols.fun).
 * Governance Tower is the control-plane (Base44 / TOLS Platform, domain
 * tolscrypto.base44.app or governance.tols.fun when self-hosted).
 *
 * The bridge is bidirezionale:
 *   Casino → Tower: bet/deposit/withdrawal events, session heartbeats, health.
 *   Tower → Casino: RTP controls, limits, feature flags, session invalidation,
 *                   wallet interventions — delivered via signed webhook.
 *
 * Env:
 *   GOVERNANCE_TOWER_URL  — Tower origin, e.g. https://tolscrypto.base44.app
 *                           Falls back to TOLS_BASE_URL's origin when unset.
 *   TOLS_BASE_URL         — Tower API base (…/api). Legacy alias for the same.
 *   APP_URL               — Casino public origin (https://tols.fun)
 *   GOVERNANCE_BRIDGE_SECRET / GOVERNANCE_WEBHOOK_SECRET — shared HMAC secret
 *                           for webhook authenticity (either name accepted).
 *   TOLS_API_KEY / TOLS_APP_KEY — Tower API credentials (env or admin Settings).
 */

// ── Config ───────────────────────────────────────────────────────────────

export interface BridgeConfig {
  towerOrigin: string;        // e.g. https://tolscrypto.base44.app
  towerApiBase: string;       // e.g. https://tolscrypto.base44.app/api
  casinoOrigin: string;       // e.g. https://tols.fun
  hasBridgeSecret: boolean;
  hasTowerKeys: boolean;
  hasDb: boolean;
}

function stripTrailingSlash(s: string) { return s.replace(/\/+$/, ""); }

export function getBridgeConfig(): BridgeConfig {
  const towerApiBase = stripTrailingSlash(
    process.env.TOLS_BASE_URL || "https://tolscrypto.base44.app/api"
  );
  // GOVERNANCE_TOWER_URL wins; otherwise derive origin from TOLS_BASE_URL's origin
  const rawTowerOrigin = process.env.GOVERNANCE_TOWER_URL?.trim();
  const towerOrigin = rawTowerOrigin
    ? stripTrailingSlash(rawTowerOrigin)
    : (() => { try { return new URL(towerApiBase).origin; } catch { return "https://tolscrypto.base44.app"; } })();

  const casinoOrigin = stripTrailingSlash(process.env.APP_URL || "https://tols.fun");
  const bridgeSecret = process.env.GOVERNANCE_BRIDGE_SECRET || process.env.GOVERNANCE_WEBHOOK_SECRET || "";
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
  return (process.env.GOVERNANCE_BRIDGE_SECRET || process.env.GOVERNANCE_WEBHOOK_SECRET || "").trim();
}

export function signBridgePayload(payload: string): string {
  const secret = bridgeSecret();
  if (!secret) throw new Error("GOVERNANCE_BRIDGE_SECRET not configured");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signBridgeBody(body: unknown): string {
  return signBridgePayload(typeof body === "string" ? body : JSON.stringify(body));
}

export function verifyBridgeSignature(rawBody: string, signature: string | null): boolean {
  const secret = bridgeSecret();
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase().replace(/^sha256=/, ""), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── Outbound helper (Casino → Tower) ────────────────────────────────────

export interface BridgeFetchOpts {
  path?: string;              // appended to towerApiBase, e.g. "/events/bet"
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Call the Governance Tower API. Uses TOLS_API_KEY / TOLS_APP_KEY when present.
 * Returns the raw Response so the caller can decide how to parse errors.
 */
export async function bridgeFetch(opts: BridgeFetchOpts = {}): Promise<Response> {
  const { towerApiBase } = getBridgeConfig();
  const apiKey = process.env.TOLS_API_KEY || "";
  const appKey = process.env.TOLS_APP_KEY || "";
  const path = opts.path || "";
  const url = path ? `${towerApiBase}${path.startsWith("/") ? path : `/${path}`}` : towerApiBase;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Bridge-Source": "tols-casino",
    "X-Casino-Origin": getBridgeConfig().casinoOrigin,
    ...(opts.headers || {}),
  };
  if (apiKey) { headers["x-api-key"] = apiKey; headers["api_key"] = apiKey; }
  if (appKey) { headers["x-app-key"] = appKey; headers["app_key"] = appKey; }

  // Sign outbound bridge requests when a secret is configured (tower can verify)
  if (bridgeSecret() && opts.body !== undefined) {
    const raw = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    headers["x-bridge-signature"] = `sha256=${signBridgePayload(raw)}`;
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
  try {
    const res = await bridgeFetch({ path: "/bridge/events", method: "POST", body: { type, payload, ts: new Date().toISOString(), source: "casino" } });
    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch {}
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: { error: e instanceof Error ? e.message : String(e) } };
  }
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

// ── SSO: cross-domain token (Tower ↔ Casino) ────────────────────────────

export interface BridgeSsoPayload {
  userId: string;
  email?: string;
  username?: string;
  issuedAt: number;
  nonce: string;
}

export function createBridgeSsoToken(payload: BridgeSsoPayload): string {
  const secret = bridgeSecret();
  if (!secret) throw new Error("GOVERNANCE_BRIDGE_SECRET not configured");
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

export function verifyBridgeSsoToken(token: string | undefined): BridgeSsoPayload | null {
  if (!token) return null;
  const secret = bridgeSecret();
  if (!secret) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expected = createHmac("sha256", secret).update(b64).digest("hex");
  const a = Buffer.from(expected); const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(b64, "base64url").toString()) as BridgeSsoPayload;
    // 10 minute window
    if (Date.now() - p.issuedAt > 10 * 60 * 1000) return null;
    return p;
  } catch { return null; }
}
