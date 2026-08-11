import { createHmac, timingSafeEqual } from "crypto";

/*
 * Telegram Mini App initData validation (server only).
 *
 * When the app runs inside Telegram, the client receives an initData string
 * signed by the bot. This validates it per Telegram's official algorithm so a
 * Telegram user can be authenticated without a password:
 *   secret_key = HMAC_SHA256(key="WebAppData", data=<bot_token>)
 *   hash       = HMAC_SHA256(key=secret_key, data=<data_check_string>)
 *   data_check_string = every initData key except `hash`, sorted, joined "k=v\n".
 * The computed hash must equal the `hash` param, compared in constant time.
 *
 * Fail-closed: any mismatch, expiry, or parse error returns null.
 */

export interface TelegramUser {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}

export interface ParsedInitData {
  user: TelegramUser;
  auth_date: number;
  hash: string;
  raw: string;
}

const MAX_AGE_SECONDS = 24 * 60 * 60; // reject initData older than 24h (replay)

export function validateTelegramInitData(initData: string, botToken: string): ParsedInitData | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date") ?? 0);
  if (!hash || !authDate) return null;

  const ageSec = Date.now() / 1000 - authDate;
  if (ageSec > MAX_AGE_SECONDS || ageSec < -60) return null;

  const keys = [...new Set([...params.keys()])].filter((k) => k !== "hash").sort();
  const dataCheckString = keys.map((k) => `${k}=${params.get(k)}`).join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  const a = Buffer.from(calc);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let user: TelegramUser | null = null;
  try { user = JSON.parse(params.get("user") || "null"); } catch { return null; }
  if (!user || !user.id) return null;

  return { user, auth_date: authDate, hash, raw: initData };
}
