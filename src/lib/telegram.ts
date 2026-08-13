import { db } from "@/lib/db";

// ── Telegram notifications ──────────────────────────────────────────────
// Sends operational alerts (registrations, deposits, withdrawals) to a
// Telegram chat. Config comes from env so no secrets live in code:
//   TELEGRAM_BOT_TOKEN   — from @BotFather
//   TELEGRAM_CHAT_ID     — target chat/channel/group id
//   TELEGRAM_THREAD_ID   — optional topic thread id (supergroups)
//
// Every alert is also persisted to the TelegramNotification table so the
// admin panel's monitoring view has a full audit trail even if delivery fails.

type AlertEvent =
  | "registration"
  | "login"
  | "deposit"
  | "withdrawal"
  | "deposit_pending"
  | "stars_invoice"
  | "stars_paid";

interface AlertInput {
  event: AlertEvent;
  title: string;
  message: string;
}

function esc(s: string): string {
  // Escape HTML for Telegram parse_mode=HTML
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// When a Telegram group is upgraded to a supergroup its chat id changes, and
// the old id starts returning 400 with `migrate_to_chat_id` pointing at the new
// one. We cache that per warm process so delivery self-heals even if the env
// var still holds the stale id.
let migratedChatId: string | null = null;

interface SendOutcome {
  ok: boolean;
  description?: string;
  migrateTo?: string;
}

async function sendOnce(token: string, chatId: string, threadId: string | undefined, text: string): Promise<SendOutcome> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_thread_id: threadId ? Number(threadId) : undefined,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const j = (await res.json().catch(() => null)) as
      | { ok?: boolean; description?: string; parameters?: { migrate_to_chat_id?: number } }
      | null;
    if (j?.ok) return { ok: true };
    const migrate = j?.parameters?.migrate_to_chat_id;
    return {
      ok: false,
      description: j?.description || `HTTP ${res.status}`,
      migrateTo: migrate ? String(migrate) : undefined,
    };
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : "send error" };
  }
}

export async function sendTelegramAlert({ event, title, message }: AlertInput): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = migratedChatId ?? process.env.TELEGRAM_CHAT_ID;
  const threadId = process.env.TELEGRAM_THREAD_ID;

  // Persist first so we always have a record, even on delivery failure.
  const record = await db.telegramNotification
    .create({
      data: {
        eventType: event,
        title,
        message,
        chatId: chatId ?? "",
        threadId: threadId ?? null,
        status: "pending",
      },
    })
    .catch(() => null);

  if (!token || !chatId) {
    // Not configured — leave the record as pending so the operator can see
    // that alerts are firing but delivery isn't wired up yet.
    if (record) {
      await db.telegramNotification
        .update({
          where: { id: record.id },
          data: { status: "unconfigured", errorMessage: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set" },
        })
        .catch(() => {});
    }
    return;
  }

  const text = `<b>${esc(title)}</b>\n${esc(message)}`;
  let result = await sendOnce(token, chatId, threadId || undefined, text);

  // Follow a supergroup migration once, then remember the new id for this
  // process so later alerts go straight to it.
  if (!result.ok && result.migrateTo) {
    migratedChatId = result.migrateTo;
    result = await sendOnce(token, result.migrateTo, threadId || undefined, text);
  }

  if (record) {
    await db.telegramNotification
      .update({
        where: { id: record.id },
        data: result.ok
          ? { status: "sent", sentAt: new Date() }
          : { status: "failed", errorMessage: result.description ?? "send failed" },
      })
      .catch(() => {});
  }
}

// Fire-and-forget wrapper so request latency never depends on Telegram.
export function fireTelegramAlert(input: AlertInput): void {
  void sendTelegramAlert(input).catch(() => {});
}
