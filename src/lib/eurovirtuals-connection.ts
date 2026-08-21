import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/mailer";

const SETTING_KEY = "eurovirtuals.connection.v1";
const CIPHER_PREFIX = "aes256gcm:v1";
const DEFAULT_API_BASE = "https://api.staging.betkraft.co.uk";

export const EV_CALLBACK_ACTIONS = ["player_info", "bet", "win", "rollback", "adjustment"] as const;

export interface EurovirtualsConnectionInput {
  name: string;
  apiBase: string;
  apiKey?: string;
  appKey?: string;
  enabled?: boolean;
}
export interface EurovirtualsConnection extends EurovirtualsConnectionInput {
  id: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastTestedAt: string | null;
  lastStatus: "untested" | "connected" | "error";
  lastLatencyMs: number | null;
  lastHttpStatus: number | null;
  lastError: string | null;
}

function masterKey(): Buffer {
  const source = process.env.CONNECTION_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET;
  if (!source || source.length < 16) throw new Error("CONNECTION_ENCRYPTION_KEY or ADMIN_SESSION_SECRET (16+ chars) is required to encrypt EuroVirtuals credentials");
  return createHash("sha256").update(source).digest();
}
function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [CIPHER_PREFIX, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(":");
}
function decrypt(value: string): string {
  const [algorithm, version, ivRaw, tagRaw, encryptedRaw] = value.split(":");
  if (`${algorithm}:${version}` !== CIPHER_PREFIX || !ivRaw || !tagRaw || !encryptedRaw) throw new Error("Unsupported encrypted EuroVirtuals connection payload");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}
function apiBaseUrl(value: string): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("API base must be a valid URL"); }
  if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("API base must use HTTPS");
  return parsed.toString().replace(/\/+$/, "");
}

function normalize(input: EurovirtualsConnectionInput, existing?: EurovirtualsConnection): EurovirtualsConnection {
  if (!input.name?.trim()) throw new Error("Connection name is required");
  const apiKey = (input.apiKey ?? "").trim() || existing?.apiKey || "";
  const appKey = (input.appKey ?? "").trim() || existing?.appKey || "";
  if (!apiKey) throw new Error("API key is required");
  if (!appKey) throw new Error("App key is required");
  const now = new Date().toISOString();
  return {
    id: existing?.id || randomBytes(12).toString("hex"),
    name: input.name.trim(),
    apiBase: apiBaseUrl(input.apiBase || DEFAULT_API_BASE),
    apiKey,
    appKey,
    enabled: input.enabled !== false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastTestedAt: existing?.lastTestedAt || null,
    lastStatus: existing?.lastStatus || "untested",
    lastLatencyMs: existing?.lastLatencyMs || null,
    lastHttpStatus: existing?.lastHttpStatus || null,
    lastError: existing?.lastError || null,
  };
}

export async function getEurovirtualsConnection(): Promise<EurovirtualsConnection | null> {
  const row = await db.platformSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row?.value) return null;
  return JSON.parse(decrypt(row.value)) as EurovirtualsConnection;
}
export async function saveEurovirtualsConnection(input: EurovirtualsConnectionInput): Promise<EurovirtualsConnection> {
  const existing = await getEurovirtualsConnection().catch(() => null);
  const connection = normalize(input, existing || undefined);
  await db.platformSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: encrypt(JSON.stringify(connection)), category: "integrations", description: "Encrypted EuroVirtuals operator connection" },
    update: { value: encrypt(JSON.stringify(connection)), category: "integrations", description: "Encrypted EuroVirtuals operator connection" },
  });
  return connection;
}
export async function deleteEurovirtualsConnection(): Promise<void> {
  await db.platformSetting.deleteMany({ where: { key: SETTING_KEY } });
}
export async function recordEurovirtualsConnectionTest(result: { ok: boolean; latencyMs: number; httpStatus: number | null; error?: string }): Promise<EurovirtualsConnection | null> {
  const current = await getEurovirtualsConnection();
  if (!current) return null;
  const next: EurovirtualsConnection = {
    ...current,
    updatedAt: new Date().toISOString(),
    lastTestedAt: new Date().toISOString(),
    lastStatus: result.ok ? "connected" : "error",
    lastLatencyMs: result.latencyMs,
    lastHttpStatus: result.httpStatus,
    lastError: result.error?.slice(0, 300) || null,
  };
  await db.platformSetting.update({ where: { key: SETTING_KEY }, data: { value: encrypt(JSON.stringify(next)) } });
  return next;
}
export function publicEurovirtualsConnection(connection: EurovirtualsConnection | null) {
  if (!connection) return null;
  const { apiKey: _apiKey, appKey: _appKey, ...safe } = connection;
  void _apiKey; void _appKey;
  return {
    ...safe,
    hasApiKey: Boolean(connection.apiKey),
    hasAppKey: Boolean(connection.appKey),
    apiKeyHint: connection.apiKey ? `••••${connection.apiKey.slice(-4)}` : null,
    appKeyHint: connection.appKey ? `••••${connection.appKey.slice(-4)}` : null,
  };
}

export function eurovirtualsCallbackUrls(origin = appUrl()) {
  const base = `${origin.replace(/\/+$/, "")}/api/eurovirtuals`;
  return {
    base,
    vendorGeneric: `${origin.replace(/\/+$/, "")}/api/vendor/callback`,
    actions: EV_CALLBACK_ACTIONS.map((action) => ({
      action,
      method: "POST" as const,
      path: `/api/eurovirtuals/${action}`,
      url: `${base}/${action}`,
    })),
  };
}

export async function evRuntimeCredentials(): Promise<{ apiBase: string; apiKey: string; appKey: string } | null> {
  try {
    const stored = await getEurovirtualsConnection();
    if (stored?.enabled && stored.apiBase && stored.apiKey && stored.appKey) {
      return { apiBase: stored.apiBase, apiKey: stored.apiKey, appKey: stored.appKey };
    }
  } catch { /* env fallback */ }
  const apiBase = process.env.EV_API_BASE?.trim();
  const apiKey = process.env.EV_API_KEY?.trim();
  const appKey = process.env.EV_APP_KEY?.trim();
  if (apiBase && apiKey && appKey) return { apiBase, apiKey, appKey };
  return null;
}
