import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

const SETTING_KEY = "governance.bridge.connection.v1";
const CIPHER_PREFIX = "aes256gcm:v1";

export interface GovernanceConnectionInput {
  name: string;
  towerOrigin: string;
  towerApiBase?: string;
  casinoOrigin: string;
  apiKey?: string;
  appKey?: string;
  bridgeSecret: string;
  healthPath?: string;
  webhookPath?: string;
  enabled?: boolean;
}
export interface GovernanceConnection extends GovernanceConnectionInput {
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
  if (!source || source.length < 16) throw new Error("CONNECTION_ENCRYPTION_KEY or ADMIN_SESSION_SECRET (16+ chars) is required to encrypt Governance credentials");
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
  if (`${algorithm}:${version}` !== CIPHER_PREFIX || !ivRaw || !tagRaw || !encryptedRaw) throw new Error("Unsupported encrypted Governance connection payload");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}
function origin(value: string, field: string): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`${field} must be a valid URL`); }
  if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error(`${field} must use HTTPS`);
  return parsed.origin;
}
function normalize(input: GovernanceConnectionInput, existing?: GovernanceConnection): GovernanceConnection {
  const towerOrigin = origin(input.towerOrigin, "towerOrigin");
  const casinoOrigin = origin(input.casinoOrigin, "casinoOrigin");
  const api = input.towerApiBase?.trim() || `${towerOrigin}/api`;
  const towerApiBase = new URL(api, `${towerOrigin}/`).toString().replace(/\/+$/, "");
  if (!input.name?.trim()) throw new Error("Connection name is required");
  if (!input.bridgeSecret || input.bridgeSecret.length < 32) throw new Error("Bridge secret must be at least 32 characters");
  const now = new Date().toISOString();
  return {
    id: existing?.id || randomBytes(12).toString("hex"), name: input.name.trim(), towerOrigin, towerApiBase,
    casinoOrigin, apiKey: input.apiKey?.trim() || "", appKey: input.appKey?.trim() || "",
    bridgeSecret: input.bridgeSecret.trim(), healthPath: input.healthPath?.trim() || "/api/platform/health",
    webhookPath: input.webhookPath?.trim() || "/api/platform/webhooks", enabled: input.enabled !== false,
    createdAt: existing?.createdAt || now, updatedAt: now, lastTestedAt: existing?.lastTestedAt || null,
    lastStatus: existing?.lastStatus || "untested", lastLatencyMs: existing?.lastLatencyMs || null,
    lastHttpStatus: existing?.lastHttpStatus || null, lastError: existing?.lastError || null,
  };
}

export async function getGovernanceConnection(): Promise<GovernanceConnection | null> {
  const row = await db.platformSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row?.value) return null;
  return JSON.parse(decrypt(row.value)) as GovernanceConnection;
}
export async function saveGovernanceConnection(input: GovernanceConnectionInput): Promise<GovernanceConnection> {
  const existing = await getGovernanceConnection().catch(() => null);
  const connection = normalize(input, existing || undefined);
  await db.platformSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: encrypt(JSON.stringify(connection)), category: "integrations", description: "Encrypted TOLS Governance service-to-service connection" },
    update: { value: encrypt(JSON.stringify(connection)), category: "integrations", description: "Encrypted TOLS Governance service-to-service connection" },
  });
  return connection;
}
export async function deleteGovernanceConnection(): Promise<void> {
  await db.platformSetting.deleteMany({ where: { key: SETTING_KEY } });
}
export async function recordGovernanceConnectionTest(result: { ok: boolean; latencyMs: number; httpStatus: number | null; error?: string }): Promise<GovernanceConnection | null> {
  const current = await getGovernanceConnection();
  if (!current) return null;
  const next: GovernanceConnection = { ...current, updatedAt: new Date().toISOString(), lastTestedAt: new Date().toISOString(), lastStatus: result.ok ? "connected" : "error", lastLatencyMs: result.latencyMs, lastHttpStatus: result.httpStatus, lastError: result.error?.slice(0, 300) || null };
  await db.platformSetting.update({ where: { key: SETTING_KEY }, data: { value: encrypt(JSON.stringify(next)) } });
  return next;
}
export function publicGovernanceConnection(connection: GovernanceConnection | null) {
  if (!connection) return null;
  const { bridgeSecret: _secret, apiKey: _apiKey, appKey: _appKey, ...safe } = connection;
  void _secret; void _apiKey; void _appKey;
  return { ...safe, hasBridgeSecret: true, hasApiKey: Boolean(connection.apiKey), hasAppKey: Boolean(connection.appKey), apiKeyHint: connection.apiKey ? `••••${connection.apiKey.slice(-4)}` : null, appKeyHint: connection.appKey ? `••••${connection.appKey.slice(-4)}` : null };
}
