/*
 * One typed client for the Telegram Bot API.
 *
 * Before this, five call sites each hand-rolled their own
 * `fetch("https://api.telegram.org/bot" + token + "/" + method)` with slightly
 * different error handling: some checked `ok`, some ignored the response
 * entirely, one parsed JSON without a catch. That meant a revoked token failed
 * loudly in one place and silently in another.
 *
 * Everything that talks to Telegram goes through `tg()` now.
 */

const API_ROOT = "https://api.telegram.org";

/** Bot token, or null when the bot is not configured. */
export function botToken(): string | null {
  const t = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return t ? t : null;
}

/**
 * Public origin of the deployment, without a trailing slash.
 *
 * Telegram rejects non-HTTPS Web App URLs outright, so this normalises and
 * validates rather than trusting the env var — a stray "http://" or trailing
 * slash produces a Mini App button that silently fails to open.
 */
export function appUrl(): string | null {
  const raw = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

export interface TgResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { migrate_to_chat_id?: number; retry_after?: number };
}

/**
 * Call a Bot API method. Never throws: Telegram being down must not take a
 * request down with it, so failures come back as `{ ok: false, description }`.
 */
export async function tg<T = unknown>(
  method: string,
  body: Record<string, unknown> = {},
  token = botToken(),
): Promise<TgResult<T>> {
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not set" };
  try {
    const res = await fetch(`${API_ROOT}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Telegram is a hard dependency for delivery but never for correctness;
      // a hung socket must not pin a serverless invocation open.
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => null)) as TgResult<T> | null;
    if (!json) return { ok: false, description: `HTTP ${res.status}` };
    return json;
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : "network error" };
  }
}

/* ─────────────────────── Message helpers ─────────────────────── */

/** Escape text for parse_mode=HTML. */
export function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface InlineButton {
  text: string;
  url?: string;
  web_app?: { url: string };
  callback_data?: string;
}

export async function sendMessage(args: {
  chatId: number | string;
  text: string;
  buttons?: InlineButton[][];
  threadId?: number;
  token?: string;
}): Promise<TgResult<unknown>> {
  return tg(
    "sendMessage",
    {
      chat_id: args.chatId,
      message_thread_id: args.threadId,
      text: args.text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: args.buttons ? { inline_keyboard: args.buttons } : undefined,
    },
    args.token ?? botToken(),
  );
}

export async function answerCallback(args: {
  id: string;
  text?: string;
  alert?: boolean;
}): Promise<TgResult<unknown>> {
  return tg("answerCallbackQuery", {
    callback_query_id: args.id,
    text: args.text,
    show_alert: args.alert ?? false,
  });
}

/**
 * A button that opens the Mini App.
 *
 * `startapp`-style deep links only work from a keyboard button inside a chat;
 * for a direct game link the Web App URL carries its own query string, which
 * the Mini App reads on boot.
 */
export function miniAppButton(text: string, path = ""): InlineButton | null {
  const base = appUrl();
  if (!base) return null;
  return { text, web_app: { url: `${base}${path}` } };
}
